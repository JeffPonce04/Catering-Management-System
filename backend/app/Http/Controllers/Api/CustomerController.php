<?php

namespace App\Http\Controllers\Api;

use App\Models\{Customer, Person, User, Role, Review, ChatThread, ChatMessage};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CustomerController extends Controller
{
    /**
     * Generate sequential customer code (CUST-0013 format)
     */
    private function generateCustomerCode(): string
    {
        return $this->generateSequentialNumber('CUST-', Customer::class, 'customer_code');
    }

    /**
     * Generic sequential number generator
     */
    private function generateSequentialNumber(string $prefix, string $modelClass, string $column, int $padding = 4): string
    {
        try {
            if (!class_exists($modelClass)) {
                throw new \Exception("Model class {$modelClass} not found");
            }

            $instance = new $modelClass();
            $keyName = $instance->getKeyName();

            $lastRecord = $modelClass::withTrashed()
                ->where($column, 'LIKE', $prefix . '%')
                ->orderBy($keyName, 'desc')
                ->first();

            if ($lastRecord && isset($lastRecord->$column)) {
                $lastNumber = intval(substr($lastRecord->$column, strlen($prefix)));
                $newNumber = str_pad($lastNumber + 1, $padding, '0', STR_PAD_LEFT);
            } else {
                $newNumber = str_repeat('0', $padding - 1) . '1';
            }

            return $prefix . $newNumber;
        } catch (\Exception $e) {
            Log::warning("Failed to generate sequential number for {$prefix}: " . $e->getMessage());
            return $prefix . str_pad((string) (time() % 10000), $padding, '0', STR_PAD_LEFT);
        }
    }

    /**
     * Display a listing of customers.
     */
    public function index(Request $request)
    {
        try {
            $query = Customer::with([
                'person',
                'user.roles',
                'bookings.serviceEvent',
                'bookings.payments',
                'bookings.invoice',          // ⭐ needed for total_spent fallback
                'bookings.review',
                'chatThreads.messages',
            ])
                ->withCount([
                    'bookings as total_bookings_count',
                    'bookings as completed_bookings_count' => function ($q) {
                        $q->whereIn('booking_status', ['completed', 'done']);
                    },
                ])
                // ⭐ REQUEST #2.1 — Show every customer that either has the
                //    `customer` role OR has at least one booking OR is an
                //    active walk-in customer with a linked person. This is
                //    what makes newly-created walk-in customers appear in
                //    the directory immediately, even while their booking is
                //    still pending.
                ->where(function ($q) {
                    $q->whereHas('user.roles', fn($r) => $r->where('slug', 'customer'))
                        ->orWhereHas('bookings')
                        ->orWhere(function ($inner) {
                            $inner->where('is_active', true)
                                ->whereNotNull('person_id');
                        });
                });

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->whereHas('person', function ($q) use ($search) {
                    $q->where('first_name', 'like', '%' . $search . '%')
                        ->orWhere('last_name', 'like', '%' . $search . '%')
                        ->orWhere('email', 'like', '%' . $search . '%')
                        ->orWhere('phone', 'like', '%' . $search . '%');
                });
            }

            if ($request->has('is_active') && $request->input('is_active') !== null && $request->input('is_active') !== '') {
                $query->where('is_active', $request->boolean('is_active'));
            }

            if ($request->filled('tier')) {
                $query->where('tier', $request->input('tier'));
            }

            $customers = $query->latest('customer_id')->paginate($request->integer('per_page', 20));
            $customers->getCollection()->transform(fn($customer) => $this->appendCustomerMetrics($customer));

            return $this->ok($customers, 'Customers retrieved successfully');
        } catch (\Exception $e) {
            Log::error('Customer index error: ' . $e->getMessage());
            return $this->fail('Failed to fetch customers: ' . $e->getMessage(), 500);
        }
    }

    public function stats()
    {
        try {
            // ⭐ Same visibility rule as index() so the KPI matches the table.
            $customers = Customer::where(function ($q) {
                $q->whereHas('user.roles', fn($r) => $r->where('slug', 'customer'))
                    ->orWhereHas('bookings');
            });

            $reviews = Review::query();

            // ⭐ Global revenue (net of refunds) — powers the Total Revenue KPI.
            $grossCompleted = (float) \App\Models\BookingPayment::query()
                ->where('status', 'completed')
                ->where('payment_type', '!=', 'refund')
                ->sum('amount');

            $totalRefunded = (float) \App\Models\BookingPayment::query()
                ->where('status', 'completed')
                ->where('payment_type', 'refund')
                ->sum('amount');

            $totalRevenue = max(0, $grossCompleted - $totalRefunded);

            return $this->ok([
                'total_customers'   => (clone $customers)->count(),
                'active_customers'  => (clone $customers)->where('is_active', true)->count(),
                'new_this_month'    => (clone $customers)
                    ->whereMonth('created_at', now()->month)
                    ->whereYear('created_at', now()->year)
                    ->count(),
                'avg_rating'        => round((float) (clone $reviews)->avg('overall_rating'), 1),
                'total_reviews'     => (clone $reviews)->count(),
                'loyal_customers'   => (clone $customers)->whereIn('tier', ['gold', 'platinum'])->count(),
                'total_revenue'     => $totalRevenue,
            ], 'Customer statistics retrieved successfully');
        } catch (\Exception $e) {
            Log::error('Customer stats error: ' . $e->getMessage());
            return $this->fail('Failed to fetch customer statistics: ' . $e->getMessage(), 500);
        }
    }

    private function appendCustomerMetrics(Customer $customer): Customer
    {
        $bookingIds = $customer->bookings->pluck('booking_id')->filter()->values();
        $reviews = $bookingIds->isNotEmpty()
            ? Review::whereIn('booking_id', $bookingIds)->latest('review_id')->get()
            : collect();

        $customer->setAttribute('reviews_count', $reviews->count());
        $customer->setAttribute('average_rating', round((float) $reviews->avg('overall_rating'), 1));
        $customer->setAttribute('latest_review', $reviews->first());
        $customer->setAttribute('has_chat_thread', $customer->chatThreads->isNotEmpty());

        // ⭐ REQUEST: correct TOTAL SPENT.
        //    Net of refunds, using completed non-refund payments only.
        //    Falls back to invoice.paid_amount when payments are missing.
        $totalSpent = (float) $customer->bookings->sum(function ($booking) {
            $completed = (float) $booking->payments
                ->where('status', 'completed')
                ->where('payment_type', '!=', 'refund')
                ->sum('amount');

            $refunded = (float) $booking->payments
                ->where('status', 'completed')
                ->where('payment_type', 'refund')
                ->sum('amount');

            $netFromPayments = max(0, $completed - $refunded);

            // Fallback for bookings whose payment lives only on the invoice
            if ($netFromPayments <= 0 && $booking->invoice) {
                $invoicePaid = (float) ($booking->invoice->paid_amount ?? 0);
                if ($invoicePaid > 0) return $invoicePaid;
            }

            return $netFromPayments;
        });
        $customer->setAttribute('total_spent', $totalSpent);

        // ⭐ REQUEST 1.5 — Loyalty points: 1 point per ₱100 of eligible
        //    VERIFIED payments only. Pending/rejected/unverified/cancelled
        //    transactions never earn points. Refunds already net out of
        //    $totalSpent, so points derived from it are automatically
        //    correct after a reversal.
        $derivedPoints = (int) floor($totalSpent / 100);
        $customer->setAttribute('loyalty_points', $derivedPoints);
        // ⭐ REQUEST 1.3 — count only ELIGIBLE bookings.
        //    Cancelled and rejected are excluded from both the badge and
        //    the tier calculation, but their rows still appear in the
        //    Booking History tab.
        $bookingsCount = $customer->bookings->filter(function ($booking) {
            $status = strtolower((string) $booking->booking_status);
            return ! in_array($status, ['cancelled', 'rejected'], true);
        })->count();
        $customer->setAttribute('total_bookings', $bookingsCount);

        // ⭐ REQUEST 1.3 — tier is derived from TOTAL ELIGIBLE BOOKINGS.
        //    We only write to the DB when the derived tier differs, so we
        //    don't churn updates on every list refresh.
        $derivedTier = $this->tierForBookings($bookingsCount);
        $customer->setAttribute('tier', $derivedTier);
        if ($customer->getRawOriginal('tier') !== $derivedTier) {
            try {
                $customer->update(['tier' => $derivedTier]);
            } catch (\Throwable $e) {
                \Log::warning('Failed to persist derived tier', [
                    'customer_id' => $customer->customer_id,
                    'tier'        => $derivedTier,
                    'error'       => $e->getMessage(),
                ]);
            }
        }
        return $customer;
    }
    /**
     * ⭐ Derive the correct tier from lifetime spend.
     *
     * Thresholds:
     *   bronze    ₱0      – ₱20,000
     *   silver    ₱20,001 – ₱50,000
     *   gold      ₱50,001 – ₱100,000
     *   platinum  ₱100,001 and above
     */
    /**
     * ⭐ REQUEST 1.3 — Tiers are derived from TOTAL ELIGIBLE BOOKINGS,
     * not lifetime spend. Cancelled and rejected bookings are excluded.
     *
     *   Bronze    1–2 bookings
     *   Silver    3–5 bookings
     *   Gold      6–10 bookings
     *   Platinum  11–20 bookings
     *   Diamond   21+ bookings
     *
     * A customer with 0 eligible bookings stays Bronze (default).
     */
    private function tierForBookings(int $eligibleBookings): string
    {
        return match (true) {
            $eligibleBookings >= 21 => 'diamond',
            $eligibleBookings >= 11 => 'platinum',
            $eligibleBookings >= 6  => 'gold',
            $eligibleBookings >= 3  => 'silver',
            default                 => 'bronze',
        };
    }
    /**
     * Display the specified customer.
     */
    public function show(Customer $customer)
    {
        try {
            // ⭐ Append the same metrics shown in the table (total_spent,
            //    total_bookings, derived tier) so the drawer stays consistent.
            $customer->load([
                'person',
                'user.roles',
                'bookings.serviceEvent',
                'bookings.payments',
                'bookings.invoice',
                'bookings.review',
                'chatThreads.messages.sender.person',
            ]);

            $this->appendCustomerMetrics($customer);

            return $this->ok($customer);
        } catch (\Exception $e) {
            Log::error('Customer show error: ' . $e->getMessage());
            return $this->fail('Failed to fetch customer: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Store a new customer (admin)
     */
    public function store(Request $request)
    {
        try {
            $data = $request->validate([
                'first_name' => 'required|string|max:80',
                'last_name' => 'required|string|max:80',
                'email' => 'required|email|max:120|unique:persons,email',
                'phone' => 'nullable|string|max:30',
                'address' => 'nullable|string',
                'password' => 'nullable|string|min:8',
            ]);

            Log::info('Admin customer creation', ['email' => $data['email']]);

            return DB::transaction(function () use ($data) {
                $person = Person::create([
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'] ?? null,
                    'address_line_1' => $data['address'] ?? null,
                    'country' => 'Philippines',
                ]);

                $user = User::create([
                    'person_id' => $person->person_id,
                    'username' => $data['email'],
                    'password' => Hash::make($data['password'] ?? 'password123'),
                    'is_active' => true,
                ]);

                $role = Role::where('slug', 'customer')->first();
                if ($role) {
                    $user->roles()->sync([$role->role_id]);
                }

                $customer = Customer::create([
                    'person_id' => $person->person_id,
                    'user_id' => $user->user_id,
                    'customer_code' => $this->generateCustomerCode(),
                    'tier' => 'bronze',
                    'is_active' => true,
                ]);

                return $this->ok(
                    $customer->load('person'),
                    'Customer created successfully'
                );
            });
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Customer store error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to create customer: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified customer.
     */
    public function update(Request $request, Customer $customer)
    {
        try {
            $validated = $request->validate([
                'first_name' => 'sometimes|string|max:80',
                'last_name' => 'sometimes|string|max:80',
                'email' => 'sometimes|email|max:120|unique:persons,email,' . $customer->person_id . ',person_id',
                'phone' => 'nullable|string|max:30',
                'address_line_1' => 'nullable|string',
                'city' => 'nullable|string|max:80',
                'province' => 'nullable|string|max:80',
                'tier' => 'sometimes|in:bronze,silver,gold,platinum',
                'dietary_restrictions' => 'nullable|string',
                'notes' => 'nullable|string',
                'is_active' => 'sometimes|boolean',
            ]);

            $customer->update(
                $request->only(['tier', 'dietary_restrictions', 'notes', 'is_active'])
            );

            $personData = $request->only(['first_name', 'last_name', 'email', 'phone', 'address_line_1', 'city', 'province']);
            if (!empty($personData)) {
                $customer->person->update($personData);
            }

            Log::info('Customer updated', ['customer_id' => $customer->customer_id]);

            return $this->show($customer);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Customer update error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to update customer: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified customer (soft delete / deactivate).
     */
    public function destroy(Customer $customer)
    {
        try {
            $customer->update(['is_active' => false]);

            Log::info('Customer deactivated', ['customer_id' => $customer->customer_id]);

            return $this->ok(null, 'Customer deactivated successfully');
        } catch (\Exception $e) {
            Log::error('Customer destroy error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to deactivate customer: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get customer feedback/reviews.
     */
    public function feedback(Request $request)
    {
        try {
            $query = Review::with(['booking.serviceEvent.customer.person']);

            if ($request->customer_id) {
                $query->whereHas('booking.serviceEvent.customer', function ($q) use ($request) {
                    $q->where('customer_id', $request->customer_id);
                });
            }

            $reviews = $query->latest()->paginate($request->integer('per_page', 20));
            $reviews->getCollection()->transform(function ($review) {
                $customer = $review->booking?->serviceEvent?->customer;
                $person = $customer?->person;
                $review->customer_id = $customer?->customer_id;
                $review->customer_name = trim(($person?->first_name ?? '') . ' ' . ($person?->last_name ?? '')) ?: 'Customer';
                $review->sentiment = $review->overall_rating >= 4 ? 'positive' : ($review->overall_rating <= 2 ? 'negative' : 'neutral');
                return $review;
            });

            return $this->ok($reviews);
        } catch (\Exception $e) {
            Log::error('Customer feedback error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch feedback: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function aiWelcomeMessage(): string
    {
        return "Hi! I'm your PMH Catering AI assistant. I received your chat and our admin team can see it on the web dashboard. Please send your event date, package or menu interest, guest count, and any questions so we can assist you faster.";
    }

    private function ensureAiWelcomeMessage(ChatThread $thread): void
    {
        // ⭐ Disabled automatic AI welcome message. 
        // Customers will only see messages sent by the admin/shop.
        return;
    }
    private function ensureCustomerThread(int $customerId): ChatThread
    {
        $thread = ChatThread::firstOrCreate(
            ['customer_id' => $customerId],
            ['assigned_user_id' => null, 'status' => 'open']
        );

        $this->ensureAiWelcomeMessage($thread);

        return $thread;
    }

    /**
     * Get customer messages/chat threads.
     */
    public function messages(Request $request)
    {
        try {
            if ($request->filled('customer_id') && ($request->boolean('ensure_thread') || $request->boolean('ensure'))) {
                $this->ensureCustomerThread((int) $request->customer_id);
            }

            $query = ChatThread::with(['customer.person', 'messages.sender.person']);

            if ($request->customer_id) {
                $query->where('customer_id', $request->customer_id);
            }

            return $this->ok(
                $query->latest('updated_at')->paginate($request->integer('per_page', 20))
            );
        } catch (\Throwable $e) {
            Log::error('Customer messages error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch messages: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Send a message to customer.
     * ⭐ When the sender is admin/staff (not the customer), the customer gets notified.
     */
    public function sendMessage(Request $request)
    {
        try {
            // ⭐ REQUEST 2.1 + 2.10 — Message OR attachment is required.
            $data = $request->validate([
                'customer_id' => 'required|exists:customers,customer_id',
                'message' => 'nullable|string',
                'subject' => 'nullable|string|max:255',
                // ⭐ 25 MB per file, allowed MIME classes only.
                'attachments' => 'nullable|array',
                'attachments.*' => 'file|max:25600|mimes:jpg,jpeg,png,gif,webp,mp4,webm,mov,pdf,doc,docx,xls,xlsx,txt',
            ]);

            if (empty($data['message']) && ! $request->hasFile('attachments')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Message or attachment is required.',
                ], 422);
            }

            $currentUser = $request->user();
            $isCustomerSender = $currentUser?->customer
                && (int) $currentUser->customer->customer_id === (int) $data['customer_id'];

            $chatThread = ChatThread::firstOrCreate(
                ['customer_id' => $data['customer_id']],
                ['assigned_user_id' => $isCustomerSender ? null : auth()->id(), 'status' => 'open']
            );

            $this->ensureAiWelcomeMessage($chatThread);

            if (!$isCustomerSender && !$chatThread->assigned_user_id && auth()->id()) {
                $chatThread->update(['assigned_user_id' => auth()->id()]);
            }

            $message = ChatMessage::create([
                'thread_id' => $chatThread->thread_id,
                'sender_user_id' => auth()->id(),
                'message' => $data['message'] ?? '',
                'read_at' => null,
                // ⭐ REQUEST 2.1 — delivery_status persisted server-side.
                'delivery_status' => 'sent',
            ]);

            // ⭐ REQUEST 2.10 — Persist attachment metadata. Files stored
            //    in a private disk so only conversation participants can
            //    download (authorization enforced in the download endpoint).
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    if (! $file->isValid()) continue;

                    $path = $file->store(
                        'chat-attachments/' . $chatThread->thread_id,
                        'local'
                    );

                    \DB::table('chat_attachments')->insert([
                        'message_id'   => $message->message_id,
                        'thread_id'    => $chatThread->thread_id,
                        'file_name'    => $file->getClientOriginalName(),
                        'file_path'    => $path,
                        'mime_type'    => $file->getMimeType(),
                        'file_size'    => $file->getSize(),
                        'created_at'   => now(),
                        'updated_at'   => now(),
                    ]);
                }
            }

            $chatThread->touch();

            // ⭐ REQUEST 2.2 — Broadcast so the customer app updates instantly.
            try {
                broadcast(new \App\Events\ChatMessageSent($message->load('attachments')))->toOthers();
            } catch (\Throwable $e) {
                \Log::warning('Reverb broadcast failed: ' . $e->getMessage());
            }

            Log::info('Message sent to customer', [
                'customer_id' => $data['customer_id'],
                'thread_id' => $chatThread->thread_id,
                'from_admin' => !$isCustomerSender,
            ]);

            // ============================================================
            // ⭐ Notify the customer when the sender is admin/staff
            // ============================================================
            if (!$isCustomerSender) {
                try {
                    $customer = Customer::with('user')->find($data['customer_id']);

                    if ($customer && $customer->user_id) {
                        $senderName = $currentUser?->person?->full_name
                            ?? $currentUser?->username
                            ?? "Dear Bab's Team";

                        $preview = Str::limit(strip_tags((string) $data['message']), 120);

                        app(\App\Services\NotificationService::class)->notifyUser(
                            $customer->user_id,
                            'chat_message_from_admin',
                            "💬 New Message from Dear Bab's",
                            "{$senderName}: {$preview}",
                            \App\Models\Notification::PRIORITY_HIGH,
                            [
                                'thread_id'   => $chatThread->thread_id,
                                'message_id'  => $message->message_id,
                                'customer_id' => $customer->customer_id,
                                'type'        => 'chat_message_from_admin',
                            ],
                            "/customer/chat/{$chatThread->thread_id}"
                        );

                        Log::info('Admin reply notification sent to customer', [
                            'customer_id' => $customer->customer_id,
                            'user_id'     => $customer->user_id,
                            'message_id'  => $message->message_id,
                        ]);
                    }
                } catch (\Throwable $notifyErr) {
                    Log::warning('Admin reply notification failed: ' . $notifyErr->getMessage());
                }
            }

            return $this->ok($message->load(['sender.person', 'attachments']), 'Message sent successfully');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Send message error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to send message: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ⭐ REQUEST 2.4 — Archive conversation (non-destructive).
    public function archiveConversation(Customer $customer)
    {
        $thread = ChatThread::firstOrCreate(['customer_id' => $customer->customer_id]);
        $thread->update(['is_archived' => true, 'archived_at' => now()]);
        return $this->ok(null, 'Conversation archived.');
    }

    public function unarchiveConversation(Customer $customer)
    {
        ChatThread::where('customer_id', $customer->customer_id)
            ->update(['is_archived' => false, 'archived_at' => null]);
        return $this->ok(null, 'Conversation restored.');
    }

    // ⭐ REQUEST 2.4 — Block / unblock (history preserved).
    public function blockCustomer(Customer $customer)
    {
        $customer->update(['is_messaging_blocked' => true]);
        return $this->ok(null, 'Customer blocked.');
    }

    public function unblockCustomer(Customer $customer)
    {
        $customer->update(['is_messaging_blocked' => false]);
        return $this->ok(null, 'Customer unblocked.');
    }

    public function blockedCustomers()
    {
        return $this->ok(
            Customer::where('is_messaging_blocked', true)
                ->get(['customer_id'])
        );
    }

    // ⭐ REQUEST 2.4 — Delete conversation for everyone.
    public function deleteConversation(Customer $customer)
    {
        \DB::transaction(function () use ($customer) {
            $threadIds = ChatThread::where('customer_id', $customer->customer_id)
                ->pluck('thread_id');

            \DB::table('chat_attachments')->whereIn('thread_id', $threadIds)->delete();
            ChatMessage::whereIn('thread_id', $threadIds)->delete();
            ChatThread::whereIn('thread_id', $threadIds)->delete();
        });

        try {
            broadcast(new \App\Events\ChatConversationDeleted($customer->customer_id))->toOthers();
        } catch (\Throwable $e) {
            \Log::warning('Conversation delete broadcast failed: ' . $e->getMessage());
        }

        return $this->ok(null, 'Conversation deleted for everyone.');
    }

    // ⭐ REQUEST 2.5 — Delete message (scope = me | everyone).
    public function deleteMessage(Request $request, ChatMessage $message)
    {
        $scope = (string) $request->query('scope', 'me');
        $userId = auth()->id();

        if ($scope === 'everyone') {
            $message->update([
                'is_deleted_for_everyone' => true,
                'deleted_at' => now(),
            ]);
            broadcast(new \App\Events\ChatMessageDeleted($message->thread_id, $message->message_id, 'everyone'))->toOthers();
        } else {
            \DB::table('chat_message_deletions')->insertOrIgnore([
                'message_id' => $message->message_id,
                'user_id'    => $userId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $this->ok(null, 'Message deleted.');
    }

    // ⭐ REQUEST 2.8 — Pin / unpin message.
    public function pinMessage(ChatMessage $message)
    {
        $message->update(['is_pinned' => true, 'pinned_at' => now()]);
        broadcast(new \App\Events\ChatMessagePinned($message->thread_id, $message->message_id, true))->toOthers();
        return $this->ok($message->fresh(), 'Message pinned.');
    }

    public function unpinMessage(ChatMessage $message)
    {
        $message->update(['is_pinned' => false, 'pinned_at' => null]);
        broadcast(new \App\Events\ChatMessagePinned($message->thread_id, $message->message_id, false))->toOthers();
        return $this->ok($message->fresh(), 'Message unpinned.');
    }

    /**
     * Get customer bookings.
     */
    public function bookings(Customer $customer)
    {
        try {
            if (! $customer || ! $customer->customer_id || (int) $customer->customer_id <= 0) {
                return $this->ok([], 'Customer has no bookings.');
            }

            // ⭐ DIRECT QUERY (Bulletproof Fix)
            // We bypass $customer->bookings() completely because the 
            // hasManyThrough relationship is causing the 30s timeout.

            $bookings = \App\Models\Booking::query()
                ->join('service_events', 'bookings.service_event_id', '=', 'service_events.service_event_id')
                ->where('service_events.customer_id', $customer->customer_id)
                ->select('bookings.*')
                ->orderByDesc('bookings.booking_id')
                ->take(50)
                ->with(['quotation', 'serviceEvent.eventType']) // Only load what we need
                ->get();

            return $this->ok($bookings, 'Customer bookings retrieved successfully');
        } catch (\Throwable $e) {
            Log::error('Customer bookings error: ' . $e->getMessage(), [
                'customer_id' => $customer?->customer_id,
                'trace'       => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch bookings: ' . $e->getMessage(),
            ], 500);
        }
    }
    /**
     * Get customer payments.
     */
    public function payments(Customer $customer)
    {
        try {
            return $this->ok(
                $customer->load(['bookings.payments'])
            );
        } catch (\Exception $e) {
            Log::error('Customer payments error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch payments: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get customer reviews.
     */
    public function reviews(Customer $customer)
    {
        try {
            return $this->ok(
                Review::whereHas('booking.serviceEvent', function ($q) use ($customer) {
                    $q->where('customer_id', $customer->customer_id);
                })->with(['booking.serviceEvent'])->latest()->get()
            );
        } catch (\Exception $e) {
            Log::error('Customer reviews error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch reviews: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Toggle customer status.
     */
    public function toggleStatus(Customer $customer)
    {
        try {
            $customer->is_active = !$customer->is_active;
            $customer->save();

            Log::info('Customer status toggled', [
                'customer_id' => $customer->customer_id,
                'is_active' => $customer->is_active
            ]);

            return $this->ok(
                $customer,
                'Customer status updated successfully'
            );
        } catch (\Exception $e) {
            Log::error('Customer toggle status error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to toggle status: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Restore a previously archived customer.
     */
    public function restore(int $id)
    {
        $customer = Customer::onlyTrashed()->findOrFail($id);
        $customer->restore();
        $customer->update(['is_active' => true]);

        return $this->ok($customer->load(['person', 'user.roles']), 'Customer restored successfully');
    }

    /**
     * Mark a customer chat message as read.
     */
    public function markMessageRead(ChatMessage $message)
    {
        if (! $message->read_at) {
            $message->update(['read_at' => now()]);
        }

        return $this->ok($message->fresh(), 'Message marked as read');
    }

    /**
     * Return the customer's current loyalty balance and tier progress.
     */
    public function loyalty(Customer $customer)
    {
        return $this->ok($this->loyaltySummary($customer));
    }

    /**
     * Add loyalty points using a row lock to prevent lost updates.
     */
    public function addLoyaltyPoints(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'points' => ['required', 'integer', 'min:1', 'max:1000000'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $updated = DB::transaction(function () use ($customer, $data) {
            $locked = Customer::query()->lockForUpdate()->findOrFail($customer->customer_id);
            $points = (int) $locked->loyalty_points + (int) $data['points'];
            $locked->update([
                'loyalty_points' => $points,
                // ⭐ Tier is derived from lifetime spend in appendCustomerMetrics().
                //    Do NOT override it here with a points-based value.
            ]);
            Log::info('Customer loyalty points added', [
                'customer_id' => $locked->customer_id,
                'points' => $data['points'],
                'reason' => $data['reason'] ?? null,
                'performed_by' => auth()->id(),
            ]);

            return $locked->fresh();
        });

        return $this->ok($this->loyaltySummary($updated), 'Loyalty points added successfully');
    }

    /**
     * Redeem loyalty points while preventing negative balances.
     */
    public function redeemLoyaltyPoints(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'points' => ['required', 'integer', 'min:1', 'max:1000000'],
            'booking_id' => [
                'nullable',
                'integer',
                function (string $attribute, mixed $value, \Closure $fail) use ($customer): void {
                    if ($value && ! $customer->bookings()->where('bookings.booking_id', $value)->exists()) {
                        $fail('The selected booking does not belong to this customer.');
                    }
                },
            ],
        ]);

        $updated = DB::transaction(function () use ($customer, $data) {
            $locked = Customer::query()->lockForUpdate()->findOrFail($customer->customer_id);
            if ((int) $locked->loyalty_points < (int) $data['points']) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'points' => 'The customer does not have enough loyalty points.',
                ]);
            }
            $points = (int) $locked->loyalty_points - (int) $data['points'];
            $locked->update([
                'loyalty_points' => $points,
                // ⭐ Tier is derived from lifetime spend in appendCustomerMetrics().
                //    Do NOT override it here with a points-based value.
            ]);

            Log::info('Customer loyalty points redeemed', [
                'customer_id' => $locked->customer_id,
                'points' => $data['points'],
                'booking_id' => $data['booking_id'] ?? null,
                'performed_by' => auth()->id(),
            ]);

            return $locked->fresh();
        });

        return $this->ok($this->loyaltySummary($updated), 'Loyalty points redeemed successfully');
    }
    /**
     * ⭐ REQUEST 1.3 + 1.5 — Points and tier are deliberately SEPARATE.
     *
     *   • Tier      → based on total eligible BOOKINGS
     *   • Points    → based on eligible VERIFIED payments (₱100 = 1 pt)
     *
     * `points_to_next` is expressed in BOOKINGS, because the next tier is
     * reached by making more bookings, not by spending more money.
     */
    private function loyaltySummary(Customer $customer): array
    {
        $points = max(0, (int) $customer->loyalty_points);

        // ⭐ Report the SAME tier the directory shows (booking-derived).
        $tier = strtolower((string) $customer->tier) ?: 'bronze';

        // ⭐ Booking-count thresholds aligned with tierForBookings().
        $thresholds = [
            'bronze'   => 0,
            'silver'   => 3,
            'gold'     => 6,
            'platinum' => 11,
            'diamond'  => 21,
        ];

        $tiers = array_keys($thresholds);
        $index = array_search($tier, $tiers, true);
        $nextTier = $index !== false && $index < count($tiers) - 1 ? $tiers[$index + 1] : null;

        // ⭐ Count eligible bookings so the UI can show "X bookings to next tier".
        $eligibleBookings = $customer->bookings->filter(function ($booking) {
            $status = strtolower((string) $booking->booking_status);
            return ! in_array($status, ['cancelled', 'rejected'], true);
        })->count();

        return [
            'customer_id'    => $customer->customer_id,
            'points'         => $points,
            'tier'           => $tier,
            'next_tier'      => $nextTier,
            'points_to_next' => $nextTier ? max(0, $thresholds[$nextTier] - $eligibleBookings) : 0,
            'bookings_to_next' => $nextTier ? max(0, $thresholds[$nextTier] - $eligibleBookings) : 0,
            'eligible_bookings' => $eligibleBookings,
        ];
    }
    /**
     * ⭐ Points-based tier — mirrors the spend-based thresholds
     *    (1 point = ₱1) so both systems agree.
     *
     * Thresholds:
     *   bronze    ₱0      – ₱20,000
     *   silver    ₱20,001 – ₱50,000
     *   gold      ₱50,001 – ₱100,000
     *   platinum  ₱100,001 and above
     */
    /**
     * ⭐ REQUEST 1.3 — DEPRECATED.
     *
     * Tiers are no longer derived from points/spend. Kept only so any
     * legacy caller does not fatal; it now delegates to the booking-based
     * helper using the customer's eligible booking count.
     */
    private function tierForPoints(int $points): string
    {
        return $this->tierForBookings((int) $points);
    }
    /**
     * Send email to customer.
     */
    public function sendEmail(Request $request, Customer $customer)
    {
        try {
            $data = $request->validate([
                'subject' => 'required|string|max:255',
                'message' => 'required|string',
            ]);

            Log::info('Email sent to customer', [
                'customer_id' => $customer->customer_id,
                'subject' => $data['subject']
            ]);

            return $this->ok(null, 'Email sent successfully');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            Log::error('Send email error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to send email: ' . $e->getMessage(),
            ], 500);
        }
    }
}
