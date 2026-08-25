<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\BookingRequest;
use App\Models\Booking;
use App\Models\BookingPayment;
use App\Models\EventTracking;
use App\Models\InventoryStock;
use App\Models\Setting;
use App\Models\PurchaseRequest;
use App\Models\Ingredient;
use App\Models\MenuItem;
use App\Models\EventDay;
use App\Models\MealService;
use App\Services\BookingService;
use App\Services\InventoryService;
use App\Services\NotificationService;
use App\Traits\Auditable;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use App\Mail\BookingConfirmationMail;
use Illuminate\Support\Facades\Mail;

class BookingController extends Controller
{
    use Auditable;

    private function query()
    {
        return Booking::query()->with($this->bookingRelations());
    }

    private function bookingRelations(): array
    {
        $relations = [
            'serviceEvent.customer.person',
            'serviceEvent.eventType',
            'serviceEvent.package',
            'quotation',
            'items.menuItem.recipeIngredients.ingredient',
            'payments',
            'order',
            'invoice',
            'equipment.equipment',
            'tracking',
        ];

        if (Schema::hasTable('event_days')) {
            $relations[] = 'eventDays';
        }

        if (Schema::hasTable('meal_services')) {
            $relations[] = 'mealServices.menuItem';
            $relations[] = 'mealServices.package';

            if (Schema::hasTable('meal_service_filters')) {
                $relations[] = 'mealServices.filters';
            }

            if (Schema::hasTable('meal_service_custom_items')) {
                $relations[] = 'mealServices.customItems.menuItem';
            }

            if (Schema::hasTable('booking_items') && Schema::hasColumn('booking_items', 'meal_service_id')) {
                $relations[] = 'items.mealService';
                if (Schema::hasTable('event_days')) {
                    $relations[] = 'items.mealService.eventDay';
                }
            }
        }

        if (Schema::hasTable('booking_charges')) {
            $relations[] = 'charges';
        }

        return $relations;
    }

    private function loadedRelationCollection(Booking $booking, string $relation): Collection
    {
        return $booking->relationLoaded($relation)
            ? $booking->getRelation($relation)
            : collect();
    }

    private function expireStaleRescheduleRequests(): void
    {
        try {
            Booking::where('booking_status', 'reschedule_requested')
                ->whereNotNull('requested_date')
                ->where('updated_at', '<=', now()->subHours(48))
                ->update([
                    'booking_status' => 'cancelled',
                    'cancellation_reason' => DB::raw("COALESCE(cancellation_reason, 'Auto-cancelled: customer did not respond to the reschedule request within 48 hours.')"),
                ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to expire stale reschedule requests: ' . $e->getMessage());
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->expireStaleRescheduleRequests();

        $query = $this->query();
        if (! $request->boolean('include_history')) {
            $query->where('booking_no', 'not like', 'HIST-%');
        }

        if ($request->filled('status_in')) {
            $statuses = collect(explode(',', (string) $request->input('status_in')))
                ->map(fn($status) => trim($status))
                ->filter()
                ->values()
                ->all();
            if (!empty($statuses)) {
                $query->whereIn('booking_status', $statuses);
            }
        } elseif ($request->filled('status')) {
            $query->where('booking_status', $request->string('status')->toString());
        }

        if ($request->filled('status_not_in')) {
            $excludedStatuses = collect(explode(',', (string) $request->input('status_not_in')))
                ->map(fn($status) => trim($status))
                ->filter()
                ->values()
                ->all();
            if (!empty($excludedStatuses)) {
                $query->whereNotIn('booking_status', $excludedStatuses);
            }
        }

        if ($request->filled('event_type_id')) {
            $query->whereHas('serviceEvent', function ($q) use ($request) {
                $q->where('event_type_id', (int) $request->input('event_type_id'));
            });
        }

        if ($request->filled('event_date')) {
            $query->whereHas('serviceEvent', function ($q) use ($request) {
                $q->whereDate('event_date', $request->string('event_date')->toString());
            });
        }

        if ($request->filled('date_from')) {
            $query->whereHas('serviceEvent', function ($q) use ($request) {
                $q->whereDate('event_date', '>=', $request->string('date_from')->toString());
            });
        }

        if ($request->filled('date_to')) {
            $query->whereHas('serviceEvent', function ($q) use ($request) {
                $q->whereDate('event_date', '<=', $request->string('date_to')->toString());
            });
        }

        if ($request->filled('booking_id')) {
            $bookingId = strtolower($request->string('booking_id')->toString());
            $query->where(function ($q) use ($bookingId) {
                $q->where('booking_no', 'like', "%{$bookingId}%")
                    ->orWhere('booking_id', $bookingId);
            });
        }

        if ($request->filled('customer_name')) {
            $customerName = strtolower($request->string('customer_name')->toString());
            $query->whereHas('serviceEvent.customer.person', function ($q) use ($customerName) {
                $q->whereRaw('LOWER(CONCAT(first_name, " ", last_name)) LIKE ?', ["%{$customerName}%"]);
            });
        }

        if ($request->filled('booking_scope')) {
            $scope = $request->string('booking_scope')->toString();
            if ($scope === 'multi_day') {
                $query->whereHas('serviceEvent', function ($q) {
                    $q->where('booking_scope', 'multi_day');
                });
            } else {
                $query->whereHas('serviceEvent', function ($q) {
                    $q->where('booking_scope', 'regular')->orWhereNull('booking_scope');
                });
            }
        }

        if ($request->filled('search')) {
            $search = strtolower($request->string('search')->toString());
            $query->where(function ($q) use ($search) {
                $q->where('booking_no', 'like', "%{$search}%")
                    ->orWhereHas('serviceEvent.customer.person', function ($person) use ($search) {
                        $person->whereRaw('LOWER(CONCAT(first_name, " ", last_name)) LIKE ?', ["%{$search}%"])
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('serviceEvent', function ($event) use ($search) {
                        $event->where('venue', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = $request->integer('per_page', 6);
        $perPage = max(1, min(100, $perPage));

        if ($request->string('sort')->toString() === 'event_schedule') {
            $query->leftJoin('service_events as schedule_events', 'bookings.service_event_id', '=', 'schedule_events.service_event_id')
                ->select('bookings.*')
                ->orderByRaw('CASE WHEN schedule_events.event_date IS NULL THEN 1 ELSE 0 END')
                ->orderBy('schedule_events.event_date');

            $driver = DB::connection()->getDriverName();
            if (in_array($driver, ['mysql', 'mariadb'], true)) {
                $query->orderByRaw("COALESCE(STR_TO_DATE(schedule_events.event_time, '%h:%i %p'), STR_TO_DATE(schedule_events.event_time, '%H:%i'), '23:59:59')");
            } else {
                $query->orderBy('schedule_events.event_time');
            }

            $query->orderBy('bookings.booking_id');
        } else {
            $query->latest('booking_id');
        }

        $bookings = $query->paginate($perPage);

        $bookings->getCollection()->transform(function ($booking) {
            return $this->formatBooking($booking);
        });

        return $this->ok($bookings);
    }

    /**
     * Send booking confirmation email + messenger notification
     */
    private function sendBookingConfirmation(Booking $booking): void
    {
        $customer = $booking->serviceEvent?->customer;
        $person = $customer?->person;
        $email = $person?->email;
        $customerName = $person?->full_name ?? 'Customer';
        $bookingNo = $booking->booking_no;
        $eventDate = $booking->serviceEvent?->event_date?->format('F d, Y') ?? 'TBD';
        $eventTime = $booking->serviceEvent?->event_time ?? 'TBD';
        $venue = $booking->serviceEvent?->venue ?? 'TBD';
        $totalAmount = number_format($booking->quotation?->total_amount ?? 0, 2);

        // 1. Send Email
        if ($email) {
            try {
                Mail::to($email)->send(new BookingConfirmationMail($booking));
                Log::info('Booking confirmation email sent to: ' . $email, [
                    'booking_id' => $booking->booking_id,
                    'booking_no' => $bookingNo
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to send booking confirmation email: ' . $e->getMessage(), [
                    'booking_id' => $booking->booking_id,
                    'email' => $email
                ]);
            }
        }

        // 2. Send In-App Notification
        if ($customer && $customer->user_id) {
            try {
                $notificationService = app(NotificationService::class);
                $notificationService->notifyUser(
                    $customer->user_id,
                    'booking_confirmed',
                    '🎉 Booking Confirmed!',
                    "Great news! Your booking {$bookingNo} has been CONFIRMED!\n\n" .
                        "📅 Event Date: {$eventDate}\n" .
                        "⏰ Time: {$eventTime}\n" .
                        "📍 Venue: {$venue}\n\n" .
                        "We look forward to serving you!",
                    \App\Models\Notification::PRIORITY_HIGH,
                    [
                        'booking_id' => $booking->booking_id,
                        'booking_no' => $bookingNo,
                        'event_date' => $eventDate,
                        'venue' => $venue,
                    ],
                    "/customer/bookings/{$booking->booking_id}"
                );
                Log::info('Booking in-app notification sent', [
                    'booking_id' => $booking->booking_id,
                    'user_id' => $customer->user_id
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to send booking in-app notification: ' . $e->getMessage(), [
                    'booking_id' => $booking->booking_id
                ]);
            }
        }

        // 3. Send Mobile Push Notification (if FCM token exists)
        if ($customer && $customer->user_id) {
            try {
                $user = \App\Models\User::find($customer->user_id);
                if ($user && $user->fcm_token) {
                    $this->sendMobilePushNotification(
                        $user,
                        '🎉 Booking Confirmed!',
                        "Your booking {$bookingNo} has been confirmed for {$eventDate} at {$eventTime}.",
                        [
                            'booking_id' => (string) $booking->booking_id,
                            'booking_no' => $bookingNo,
                            'type' => 'booking_confirmed'
                        ]
                    );
                }
            } catch (\Exception $e) {
                Log::error('Failed to send mobile push notification: ' . $e->getMessage(), [
                    'booking_id' => $booking->booking_id
                ]);
            }
        }
    }

    /**
     * Send mobile push notification via FCM
     */
    private function sendMobilePushNotification($user, $title, $body, $data = []): void
    {
        try {
            $fcmToken = $user->fcm_token ?? null;

            if (!$fcmToken) {
                Log::info('User has no FCM token set', ['user_id' => $user->user_id]);
                return;
            }

            $serverKey = config('services.fcm.server_key');

            if (!$serverKey) {
                Log::warning('FCM server key not configured');
                return;
            }

            $payload = [
                'to' => $fcmToken,
                'notification' => [
                    'title' => $title,
                    'body' => $body,
                    'sound' => 'default',
                ],
                'data' => array_merge($data, [
                    'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
                ]),
                'priority' => 'high',
            ];

            $ch = curl_init('https://fcm.googleapis.com/fcm/send');
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: key=' . $serverKey,
                'Content-Type: application/json',
            ]);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

            $response = curl_exec($ch);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                Log::error('FCM push notification error: ' . $error);
            } else {
                Log::info('FCM push notification sent', ['response' => $response]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to send mobile push notification: ' . $e->getMessage());
        }
    }

    // ============================================================
    // ⭐ FIXED: STORE METHOD - Ensures customer is created/saved
    // ============================================================
    public function store(BookingRequest $request, BookingService $service): JsonResponse
    {
        try {
            // Get customer from request
            $customer = null;

            // If customer_id is provided, use it
            if ($request->has('customer_id')) {
                $customer = \App\Models\Customer::find($request->customer_id);
            }

            // If no customer_id but we have customer data, let the service create one
            // The service's createCustomerFromData will handle this
            $booking = $service->requestBooking($customer, $request->validated());

            $payload = [
                'booking_id' => $booking->booking_id,
                'booking_no' => $booking->booking_no,
                'booking_status' => $booking->booking_status,
                'event_date' => optional($booking->serviceEvent?->event_date)->format('Y-m-d'),
                'customer_name' => $booking->serviceEvent?->customer?->person?->full_name,
                'total_amount' => $booking->quotation?->total_amount,
            ];

            $bookingId = $booking->booking_id;

            app()->terminating(function () use ($bookingId) {
                try {
                    $booking = Booking::with([
                        'serviceEvent.customer.person',
                        'quotation',
                    ])->find($bookingId);

                    if (!$booking) {
                        return;
                    }

                    $this->logCustom(
                        'store',
                        'bookings',
                        $booking->booking_id,
                        "Booking {$booking->booking_no} created",
                        [
                            'booking_no' => $booking->booking_no,
                            'customer' => $booking->serviceEvent?->customer?->person?->full_name,
                            'event_date' => $booking->serviceEvent?->event_date?->format('Y-m-d'),
                            'guests_count' => $booking->serviceEvent?->guests_count,
                            'total_amount' => $booking->quotation?->total_amount,
                            'created_at' => now()->toDateTimeString(),
                        ]
                    );

                    app(NotificationService::class)->bookingRequestReceived($booking);
                } catch (\Throwable $e) {
                    Log::warning('Booking post-create side effects failed: ' . $e->getMessage());
                }
            });

            return $this->ok($payload, 'Booking created successfully.');
        } catch (\Throwable $e) {
            Log::error('Booking store error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to create booking: ' . $e->getMessage(), 500);
        }
    }

    // ============================================================
    // ⭐ FIXED: APPROVE METHOD - Gets customer data correctly
    // ============================================================
    public function approve(Booking $booking, BookingService $service): JsonResponse
    {
        try {
            // Only the service event is needed for the pre-approval guard.
            // BookingService loads the relations required by the transaction.
            $booking->load('serviceEvent');

            $oldData = $booking->toArray();

            if (!$booking->serviceEvent) {
                Log::error('Booking approval failed: No service event found', [
                    'booking_id' => $booking->booking_id,
                    'booking_no' => $booking->booking_no
                ]);
                return $this->fail('Cannot approve booking: No service event associated with this booking.', 422);
            }

            try {
                $booking = $service->approve($booking);
            } catch (\Exception $e) {
                Log::error('Booking approval transaction failed: ' . $e->getMessage(), [
                    'booking_id' => $booking->booking_id,
                    'trace' => $e->getTraceAsString()
                ]);
                return $this->fail('Failed to approve booking: ' . $e->getMessage(), 500);
            }

            // Reload only the fields required by the immediate response. The
            // normal query() relation graph is intentionally avoided here because
            // it includes recipes, inventory stock, equipment, and tracking.
            $booking = Booking::with([
                'serviceEvent.customer.person',
                'serviceEvent.eventType',
                'quotation',
                'invoice',
                'order',
                'payments',
            ])->findOrFail($booking->booking_id);

            $approvedBookingId = $booking->booking_id;
            $approvedBookingNo = $booking->booking_no;
            $orderNumber = $booking->order?->order_number;

            // Notifications, audit logging, and admin alerts run after the HTTP
            // response so approval stays fast even when email providers are slow.
            app()->terminating(function () use ($approvedBookingId, $oldData, $approvedBookingNo) {
                try {
                    $booking = Booking::with([
                        'serviceEvent.customer.person',
                        'serviceEvent.eventType',
                        'quotation',
                        'order',
                    ])->find($approvedBookingId);

                    if (!$booking) {
                        return;
                    }

                    try {
                        $this->sendBookingConfirmation($booking);
                        Log::info('Booking confirmation notifications sent', [
                            'booking_id' => $approvedBookingId,
                            'booking_no' => $approvedBookingNo,
                        ]);
                    } catch (\Throwable $notificationError) {
                        Log::warning('Failed to send booking confirmation notifications: ' . $notificationError->getMessage(), [
                            'booking_id' => $approvedBookingId,
                        ]);
                    }

                    $customerName = $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown';

                    $this->logCustom(
                        'approve',
                        'bookings',
                        $booking->booking_id,
                        "Booking {$booking->booking_no} APPROVED",
                        [
                            'booking_no' => $booking->booking_no,
                            'customer' => $customerName,
                            'event_date' => $booking->serviceEvent?->event_date?->format('Y-m-d'),
                            'total_amount' => $booking->quotation?->total_amount,
                            'old_status' => $oldData['booking_status'] ?? 'pending',
                            'new_status' => 'confirmed',
                            'order_created' => $booking->order?->order_number,
                            'approved_at' => now()->toDateTimeString(),
                        ]
                    );

                    $notificationService = app(NotificationService::class);

                    // Notify admin
                    $notificationService->notifyRole(
                        'admin',
                        'booking_approved',
                        '🎉 Booking Approved Successfully',
                        "Booking {$booking->booking_no} has been approved and confirmed.\n\n" .
                            "👤 Customer: " . ($booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown') . "\n" .
                            "📅 Event Date: " . ($booking->serviceEvent?->event_date?->format('Y-m-d') ?? 'TBD') . "\n" .
                            "💰 Amount: ₱" . number_format($booking->quotation?->total_amount ?? 0, 2),
                        \App\Models\Notification::PRIORITY_HIGH,
                        [
                            'booking_id' => $booking->booking_id,
                            'booking_no' => $booking->booking_no,
                            'customer_name' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                        ],
                        "/admin/bookings/{$booking->booking_id}"
                    );
                } catch (\Throwable $sideEffectError) {
                    Log::warning('Booking approval side-effect failed after response: ' . $sideEffectError->getMessage());
                }
            });

            // Return a lightweight list-compatible booking payload. Avoid the
            // full formatBooking() relation graph here because recipe, inventory,
            // equipment, and tracking data are not required to insert the row in
            // Orders & Events immediately after approval.
            $booking->loadMissing([
                'serviceEvent.customer.person',
                'serviceEvent.eventType',
                'quotation',
                'invoice',
                'order',
                'payments',
            ]);
            $event = $booking->serviceEvent;
            $person = $event?->customer?->person;
            $totalAmount = (float) ($booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0);
            $paidAmount = (float) $booking->payments->where('status', 'completed')->sum('amount');

            $payload = [
                'id' => $booking->booking_id,
                'booking_id' => $booking->booking_id,
                'booking_no' => $approvedBookingNo,
                'booking_status' => 'confirmed',
                'order_number' => $orderNumber,
                'order' => $booking->order,
                'invoice' => $booking->invoice,
                'quotation' => $booking->quotation,
                'customer_name' => $person?->full_name ?? 'Unknown',
                'customer_email' => $person?->email,
                'customer_phone' => $person?->phone,
                'customer_address' => $person?->address_line_1,
                'event_type_id' => $event?->event_type_id,
                'event_type_name' => $event?->eventType?->name,
                'booking_scope' => $event?->booking_scope ?? 'regular',
                'event_date' => $event?->event_date?->toDateString(),
                'event_time' => $event?->event_time,
                'venue' => $event?->venue,
                'guests_count' => (int) ($event?->guests_count ?? 0),
                'service_type' => $event?->service_type,
                'delivery_method' => $event?->delivery_method,
                'special_requests' => $event?->special_requests,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'balance' => max(0, $totalAmount - $paidAmount),
                'payments' => $booking->payments->values(),
                'meal_services' => [],
                'assigned_staff' => [],
                'assigned_staff_count' => 0,
                'total_staff_required' => 0,
                'event_completed' => false,
                'event_done' => false,
                'event_done_at' => null,
                'progress' => 0,
                'equipment_in_out' => [],
                'kitchen_preparation' => [],
                'delivery_preparation' => [],
                'delivery_tracking' => [],
                'menu_items' => [],
                'created_at' => $booking->created_at,
                'updated_at' => $booking->updated_at,
            ];

            return $this->ok($payload, 'Booking ' . $approvedBookingNo . ' confirmed successfully!');
        } catch (\Exception $e) {
            Log::error('Booking approval failed: ' . $e->getMessage(), [
                'booking_id' => $booking->booking_id,
                'trace' => $e->getTraceAsString()
            ]);

            return $this->fail('Failed to approve booking: ' . $e->getMessage(), 500);
        }
    }

    public function show(Booking $booking): JsonResponse
    {
        $booking = $this->query()->findOrFail($booking->booking_id);
        return $this->ok($this->formatBooking($booking));
    }

    public function update(Request $request, Booking $booking, BookingService $service): JsonResponse
    {
        try {
            $user = $request->user();
            $isCashier = $user?->hasAnyRole(['cashier', 'finance', 'finance-staff', 'finance_staff']) ?? false;
            $isAdministrator = $user?->hasAnyRole(['admin', 'administrator', 'owner', 'super-admin', 'super_admin', 'superadmin']) ?? false;

            if ($isCashier && ! $isAdministrator) {
                if (! in_array($booking->booking_status, ['pending', 'draft'], true)) {
                    return $this->fail('Cashiers may only update pending booking requests.', 403);
                }

                if ($request->hasAny(['booking_status', 'cancellation_reason'])) {
                    return $this->fail('Booking approval, rejection, cancellation, and status changes require administrator approval.', 403);
                }
            }

            $oldData = $booking->toArray();

            if ($request->has('meal_services') || $request->has('charges') || $request->has('transportation_fee') || $request->has('event_date')) {
                $booking = $service->updateBookingFromAdmin($booking, $request->all());
            } else {
                $booking->update($request->only([
                    'booking_status',
                    'requested_date',
                    'requested_time',
                    'reschedule_reason',
                    'cancellation_reason',
                ]));

                $booking->serviceEvent?->update($request->only([
                    'event_date',
                    'event_end_date',
                    'event_time',
                    'venue',
                    'guests_count',
                    'service_type',
                    'delivery_method',
                    'special_requests',
                    'delivery_address',
                ]));
            }

            $this->logCustom(
                'update',
                'bookings',
                $booking->booking_id,
                "Booking {$booking->booking_no} updated",
                [
                    'booking_no' => $booking->booking_no,
                    'old_status' => $oldData['booking_status'] ?? 'pending',
                    'new_status' => $booking->booking_status,
                    'updated_at' => now()->toDateTimeString()
                ]
            );

            $booking = $this->query()->findOrFail($booking->booking_id);
            return $this->ok($this->formatBooking($booking), 'Booking updated.');
        } catch (\Exception $e) {
            Log::error('Booking update error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to update booking: ' . $e->getMessage(), 500);
        }
    }

    public function destroy(Booking $booking): JsonResponse
    {
        try {
            $oldData = $booking->toArray();

            $this->logCustom(
                'delete',
                'bookings',
                $booking->booking_id,
                "Booking {$booking->booking_no} archived",
                [
                    'booking_no' => $booking->booking_no,
                    'booking_status' => $oldData['booking_status'] ?? 'unknown',
                    'deleted_at' => now()->toDateTimeString()
                ]
            );

            $booking->delete();
            return $this->ok(null, 'Booking archived.');
        } catch (\Exception $e) {
            Log::error('Booking delete error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to delete booking: ' . $e->getMessage(), 500);
        }
    }

    public function reject(Booking $booking): JsonResponse
    {
        try {
            $oldData = $booking->toArray();

            $booking->update(['booking_status' => 'rejected']);
            $booking->serviceEvent?->update(['status' => 'cancelled']);

            $this->logCustom(
                'reject',
                'bookings',
                $booking->booking_id,
                "Booking {$booking->booking_no} REJECTED",
                [
                    'booking_no' => $booking->booking_no,
                    'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'old_status' => $oldData['booking_status'] ?? 'pending',
                    'new_status' => 'rejected',
                    'rejected_at' => now()->toDateTimeString()
                ]
            );

            $customer = $booking->serviceEvent?->customer;
            if ($customer && $customer->user_id) {
                $notificationService = app(NotificationService::class);
                $notificationService->notifyUser(
                    $customer->user_id,
                    'booking_rejected',
                    'Booking Update',
                    "We regret to inform you that your booking {$booking->booking_no} has been rejected. Please contact us for more information.",
                    \App\Models\Notification::PRIORITY_MEDIUM,
                    ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                    "/customer/bookings/{$booking->booking_id}"
                );
            }

            $notificationService = app(NotificationService::class);
            $notificationService->notifyRole(
                'admin',
                'booking_rejected',
                '❌ Booking Rejected',
                "Booking {$booking->booking_no} has been rejected.",
                \App\Models\Notification::PRIORITY_MEDIUM,
                ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                "/admin/bookings/{$booking->booking_id}"
            );

            return $this->ok($this->formatBooking($booking->fresh()), 'Booking rejected.');
        } catch (\Exception $e) {
            Log::error('Booking reject error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to reject booking: ' . $e->getMessage(), 500);
        }
    }

    public function cancel(Request $request, Booking $booking): JsonResponse
    {
        try {
            $oldData = $booking->toArray();
            $reason = $request->input('reason');

            $booking->update([
                'booking_status' => 'cancelled',
                'cancellation_reason' => $reason,
            ]);
            $booking->serviceEvent?->update(['status' => 'cancelled']);

            $this->logCustom(
                'cancel',
                'bookings',
                $booking->booking_id,
                "Booking {$booking->booking_no} CANCELLED",
                [
                    'booking_no' => $booking->booking_no,
                    'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'reason' => $reason,
                    'old_status' => $oldData['booking_status'] ?? 'pending',
                    'new_status' => 'cancelled',
                    'cancelled_at' => now()->toDateTimeString()
                ]
            );

            $notificationService = app(NotificationService::class);
            $notificationService->bookingCancelled($booking, $reason);

            return $this->ok($this->formatBooking($booking->fresh()), 'Booking cancelled.');
        } catch (\Exception $e) {
            Log::error('Booking cancel error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to cancel booking: ' . $e->getMessage(), 500);
        }
    }

    public function reschedule(Request $request, Booking $booking): JsonResponse
    {
        try {
            $oldData = $booking->toArray();

            $validated = $request->validate([
                'new_date' => ['nullable', 'date'],
                'event_date' => ['nullable', 'date'],
                'new_time' => ['nullable', 'string'],
                'event_time' => ['nullable', 'string'],
                'reason' => ['nullable', 'string'],
            ]);

            $booking->serviceEvent?->update([
                'event_date' => $validated['new_date'] ?? $validated['event_date'] ?? $booking->serviceEvent->event_date,
                'event_time' => $validated['new_time'] ?? $validated['event_time'] ?? $booking->serviceEvent->event_time,
            ]);

            $booking->update([
                'booking_status' => 'confirmed',
                'reschedule_reason' => $validated['reason'] ?? null,
            ]);

            $this->logCustom(
                'reschedule',
                'bookings',
                $booking->booking_id,
                "Booking {$booking->booking_no} RESCHEDULED",
                [
                    'booking_no' => $booking->booking_no,
                    'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'old_date' => $oldData['event_date'] ?? null,
                    'new_date' => $booking->serviceEvent?->event_date?->toDateString(),
                    'old_time' => $oldData['event_time'] ?? null,
                    'new_time' => $booking->serviceEvent?->event_time,
                    'reason' => $validated['reason'] ?? null,
                    'rescheduled_at' => now()->toDateTimeString()
                ]
            );

            $customer = $booking->serviceEvent?->customer;
            if ($customer && $customer->user_id) {
                $notificationService = app(NotificationService::class);
                $notificationService->notifyUser(
                    $customer->user_id,
                    'booking_rescheduled',
                    'Booking Rescheduled',
                    "Your booking {$booking->booking_no} has been rescheduled to {$booking->serviceEvent->event_date} at {$booking->serviceEvent->event_time}.",
                    \App\Models\Notification::PRIORITY_MEDIUM,
                    ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                    "/customer/bookings/{$booking->booking_id}"
                );
            }

            $notificationService = app(NotificationService::class);
            $notificationService->notifyRole(
                'admin',
                'booking_rescheduled',
                '🔄 Booking Rescheduled',
                "Booking {$booking->booking_no} has been rescheduled to {$booking->serviceEvent->event_date} at {$booking->serviceEvent->event_time}.",
                \App\Models\Notification::PRIORITY_MEDIUM,
                ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                "/admin/bookings/{$booking->booking_id}"
            );

            return $this->ok($this->formatBooking($booking->fresh()), 'Booking rescheduled.');
        } catch (\Exception $e) {
            Log::error('Booking reschedule error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to reschedule booking: ' . $e->getMessage(), 500);
        }
    }

    public function requestReschedule(Request $request, Booking $booking): JsonResponse
    {
        try {
            $validated = $request->validate([
                'requested_date' => ['required', 'date'],
                'requested_time' => ['required', 'string', 'max:50'],
                'reason' => ['required', 'string', 'max:500'],
            ]);

            $oldData = $booking->toArray();
            $newDate = $validated['requested_date'];
            $newTime = $validated['requested_time'];
            $reason = $validated['reason'];

            $booking->update([
                'booking_status' => 'reschedule_requested',
                'requested_date' => $newDate,
                'requested_time' => $newTime,
                'reschedule_reason' => $reason,
            ]);

            $this->logCustom(
                'reschedule_requested',
                'bookings',
                $booking->booking_id,
                "Reschedule REQUESTED for booking {$booking->booking_no}",
                [
                    'booking_no' => $booking->booking_no,
                    'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'requested_date' => $newDate,
                    'requested_time' => $newTime,
                    'reason' => $reason,
                    'old_status' => $oldData['booking_status'] ?? 'pending',
                    'new_status' => 'reschedule_requested',
                    'requested_at' => now()->toDateTimeString()
                ]
            );

            $notificationService = app(NotificationService::class);
            $notificationService->bookingRescheduleRequested($booking, $newDate, $newTime, $reason);

            return $this->ok($this->formatBooking($booking->fresh()), 'Reschedule requested.');
        } catch (\Exception $e) {
            Log::error('Request reschedule error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to request reschedule: ' . $e->getMessage(), 500);
        }
    }

    public function approveReschedule(Booking $booking): JsonResponse
    {
        try {
            $oldData = $booking->toArray();

            $booking->serviceEvent?->update([
                'event_date' => $booking->requested_date ?? $booking->serviceEvent->event_date,
                'event_time' => $booking->requested_time ?? $booking->serviceEvent->event_time,
            ]);
            $booking->update(['booking_status' => 'confirmed']);
            $this->handleConfirmedBooking($booking);

            $this->logCustom(
                'reschedule_approved',
                'bookings',
                $booking->booking_id,
                "Reschedule request APPROVED for booking {$booking->booking_no}",
                [
                    'booking_no' => $booking->booking_no,
                    'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'approved_date' => $booking->serviceEvent?->event_date?->toDateString(),
                    'approved_time' => $booking->serviceEvent?->event_time,
                    'old_status' => $oldData['booking_status'] ?? 'pending',
                    'new_status' => 'confirmed',
                    'approved_at' => now()->toDateTimeString()
                ]
            );

            $customer = $booking->serviceEvent?->customer;
            if ($customer && $customer->user_id) {
                $notificationService = app(NotificationService::class);
                $notificationService->notifyUser(
                    $customer->user_id,
                    'reschedule_approved',
                    'Reschedule Request Approved',
                    "Your reschedule request for booking {$booking->booking_no} has been approved. New date: {$booking->serviceEvent->event_date} at {$booking->serviceEvent->event_time}",
                    \App\Models\Notification::PRIORITY_HIGH,
                    ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                    "/customer/bookings/{$booking->booking_id}"
                );
            }

            $notificationService = app(NotificationService::class);
            $notificationService->notifyRole(
                'admin',
                'reschedule_approved',
                '✅ Reschedule Request Approved',
                "The reschedule request for booking {$booking->booking_no} has been approved. New date: {$booking->serviceEvent->event_date} at {$booking->serviceEvent->event_time}",
                \App\Models\Notification::PRIORITY_MEDIUM,
                ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                "/admin/bookings/{$booking->booking_id}"
            );

            return $this->ok($this->formatBooking($booking->fresh()), 'Reschedule request approved.');
        } catch (\Exception $e) {
            Log::error('Approve reschedule error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to approve reschedule: ' . $e->getMessage(), 500);
        }
    }

    public function rejectReschedule(Booking $booking): JsonResponse
    {
        try {
            $oldData = $booking->toArray();
            $booking->update(['booking_status' => 'confirmed']);
            $this->handleConfirmedBooking($booking);

            $this->logCustom(
                'reschedule_rejected',
                'bookings',
                $booking->booking_id,
                "Reschedule request REJECTED for booking {$booking->booking_no}",
                [
                    'booking_no' => $booking->booking_no,
                    'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'old_status' => $oldData['booking_status'] ?? 'pending',
                    'new_status' => 'confirmed',
                    'rejected_at' => now()->toDateTimeString()
                ]
            );

            $customer = $booking->serviceEvent?->customer;
            if ($customer && $customer->user_id) {
                $notificationService = app(NotificationService::class);
                $notificationService->notifyUser(
                    $customer->user_id,
                    'reschedule_rejected',
                    'Reschedule Request Update',
                    "We regret to inform you that your reschedule request for booking {$booking->booking_no} has been rejected. Please contact us for alternative options.",
                    \App\Models\Notification::PRIORITY_MEDIUM,
                    ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                    "/customer/bookings/{$booking->booking_id}"
                );
            }

            $notificationService = app(NotificationService::class);
            $notificationService->notifyRole(
                'admin',
                'reschedule_rejected',
                '❌ Reschedule Request Rejected',
                "The reschedule request for booking {$booking->booking_no} has been rejected.",
                \App\Models\Notification::PRIORITY_LOW,
                ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                "/admin/bookings/{$booking->booking_id}"
            );

            return $this->ok($this->formatBooking($booking->fresh()), 'Reschedule request rejected.');
        } catch (\Exception $e) {
            Log::error('Reject reschedule error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to reject reschedule: ' . $e->getMessage(), 500);
        }
    }

    public function recordPayment(Request $request, Booking $booking): JsonResponse
    {
        try {
            $validated = $request->validate([
                'amount' => ['required', 'numeric', 'min:0.01'],
                'method' => ['nullable', 'string'],
                'payment_method' => ['nullable', 'string'],
                'payment_type' => ['nullable', 'in:deposit,partial,full'],
                'reference' => ['nullable', 'string'],
                'reference_number' => ['nullable', 'string'],
                'notes' => ['nullable', 'string'],
            ]);

            $method = strtolower(str_replace(' ', '_', $validated['payment_method'] ?? $validated['method'] ?? 'cash'));
            $allowedMethods = ['cash', 'gcash', 'maya', 'bank_transfer', 'card', 'check'];

            if (! in_array($method, $allowedMethods, true)) {
                $method = 'cash';
            }

            $booking->loadMissing('invoice');
            if (! $booking->invoice) {
                return $this->fail('No invoice found for this booking. Please create an invoice first.', 422);
            }

            $payment = DB::transaction(function () use ($booking, $validated, $method) {
                $payment = BookingPayment::create([
                    'booking_id' => $booking->booking_id,
                    'payment_number' => 'PAY-' . now()->format('YmdHisv') . '-' . $booking->booking_id . '-' . random_int(100, 999),
                    'amount' => $validated['amount'],
                    'payment_method' => $method,
                    'payment_type' => $validated['payment_type'] ?? 'partial',
                    'reference_number' => $validated['reference_number'] ?? $validated['reference'] ?? null,
                    'notes' => $validated['notes'] ?? null,
                    'status' => 'completed',
                    'payment_date' => now(),
                    'verified_by' => auth()->id(),
                    'verified_at' => now(),
                ]);

                $this->synchronizeBookingInvoice($booking);
                return $payment;
            });

            $this->logCustom(
                'payment_recorded',
                'booking_payments',
                $payment->payment_id,
                "Payment of ₱{$validated['amount']} recorded for booking {$booking->booking_no}",
                [
                    'booking_id' => $booking->booking_id,
                    'booking_no' => $booking->booking_no,
                    'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'amount' => $validated['amount'],
                    'payment_method' => $method,
                    'payment_type' => $validated['payment_type'] ?? 'partial',
                    'reference_number' => $validated['reference_number'] ?? null,
                    'recorded_at' => now()->toDateTimeString()
                ]
            );

            $customer = $booking->serviceEvent?->customer;
            if ($customer && $customer->user_id) {
                $notificationService = app(NotificationService::class);
                $notificationService->paymentReceived($payment, $customer);

                $balance = $booking->invoice?->balance ?? 0;
                if ($balance > 0) {
                    $notificationService->balanceReminder($booking, $customer, $balance);
                }
            }

            $notificationService = app(NotificationService::class);
            $notificationService->notifyRole(
                'admin',
                'payment_received',
                '💰 Payment Received',
                "Payment of ₱" . number_format($validated['amount'], 2) . " has been received for booking {$booking->booking_no}.",
                \App\Models\Notification::PRIORITY_HIGH,
                ['booking_id' => $booking->booking_id, 'amount' => $validated['amount']],
                "/admin/payments"
            );

            return $this->ok($payment, 'Payment recorded.');
        } catch (\Exception $e) {
            Log::error('Record payment error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to record payment: ' . $e->getMessage(), 500);
        }
    }

    public function paymentSummary(Booking $booking, BookingService $service): JsonResponse
    {
        return $this->ok($service->paymentSummary($booking));
    }

    public function calendar(): JsonResponse
    {
        try {
            $events = $this->query()
                ->where('booking_no', 'not like', 'HIST-%')
                ->whereIn('booking_status', ['confirmed', 'rescheduled', 'completed'])
                ->get()
                ->map(function (Booking $booking): array {
                    $formatted = $this->formatBooking($booking);
                    $endDate = $formatted['event_date'];
                    if ($formatted['days'] > 1) {
                        $start = Carbon::parse($formatted['event_date']);
                        $endDate = $start->copy()->addDays($formatted['days'] - 1)->toDateString();
                    }
                    return [
                        'id' => $booking->booking_id,
                        'title' => $booking->booking_no . ' - ' . $formatted['customer_name'],
                        'start' => $formatted['event_date'],
                        'end' => $endDate,
                        'status' => $booking->booking_status,
                        'extendedProps' => [
                            'event_time' => $formatted['event_time'],
                            'venue' => $formatted['venue'],
                            'service_type' => $formatted['service_type'],
                            'days' => $formatted['days'],
                            'is_multi_day' => $formatted['days'] > 1,
                        ],
                    ];
                });
            return $this->ok($events);
        } catch (\Exception $e) {
            Log::error('Calendar error: ' . $e->getMessage());
            return $this->fail('Failed to load calendar events: ' . $e->getMessage(), 500);
        }
    }

    public function conflicts(Request $request): JsonResponse
    {
        try {
            $date = $request->input('event_date');
            if (! $date) {
                return $this->ok(['has_conflicts' => false, 'conflicts' => []]);
            }

            $bookings = $this->query()
                ->whereHas('serviceEvent', fn($query) => $query->whereDate('event_date', $date))
                ->get()
                ->map(fn(Booking $booking) => $this->formatBooking($booking));

            return $this->ok([
                'has_conflicts' => $bookings->count() > 1,
                'conflicts' => $bookings->count() > 1
                    ? [['date' => $date, 'bookings' => $bookings->values()]]
                    : [],
            ]);
        } catch (\Exception $e) {
            Log::error('Conflicts check error: ' . $e->getMessage());
            return $this->fail('Failed to check conflicts: ' . $e->getMessage(), 500);
        }
    }

    public function checkConflictsAndNotify(Request $request): JsonResponse
    {
        try {
            $date = $request->input('event_date');
            if (!$date) {
                return $this->ok(['has_conflicts' => false]);
            }

            $conflicts = $this->query()
                ->whereHas('serviceEvent', fn($q) => $q->whereDate('event_date', $date))
                ->whereIn('booking_status', ['pending_approval', 'confirmed'])
                ->get();

            if ($conflicts->count() > 1) {
                $notificationService = app(NotificationService::class);
                $notificationService->scheduleConflictWarning($date, $conflicts->toArray());

                $this->logCustom(
                    'conflict_detected',
                    'bookings',
                    null,
                    "Schedule conflict detected on {$date}",
                    [
                        'date' => $date,
                        'conflict_count' => $conflicts->count(),
                        'booking_ids' => $conflicts->pluck('booking_id')->toArray(),
                        'detected_at' => now()->toDateTimeString()
                    ]
                );
            }

            return $this->ok([
                'has_conflicts' => $conflicts->count() > 1,
                'conflicts' => $conflicts,
            ]);
        } catch (\Exception $e) {
            Log::error('Check conflicts notify error: ' . $e->getMessage());
            return $this->fail('Failed to check conflicts: ' . $e->getMessage(), 500);
        }
    }

    public function statistics(): JsonResponse
    {
        try {
            $bookings = $this->query()->where('booking_no', 'not like', 'HIST-%')->get()->map(fn(Booking $booking) => $this->formatBooking($booking));

            return $this->ok([
                'total_bookings' => $bookings->count(),
                'pending_approvals' => $bookings->where('booking_status', 'pending_approval')->count(),
                'confirmed_bookings' => $bookings->where('booking_status', 'confirmed')->count(),
                'completed_bookings' => $bookings->where('booking_status', 'completed')->count(),
                'regular_bookings' => $bookings->where('days', '<=', 1)->count(),
                'multi_day_events' => $bookings->where('days', '>', 1)->count(),
                'total_revenue' => $bookings->sum('total_amount'),
                'total_paid' => $bookings->sum('paid_amount'),
                'total_outstanding' => $bookings->sum('balance'),
            ]);
        } catch (\Exception $e) {
            Log::error('Statistics error: ' . $e->getMessage());
            return $this->fail('Failed to load statistics: ' . $e->getMessage(), 500);
        }
    }

    public function getAvailability(Request $request): JsonResponse
    {
        try {
            $startDate = $request->input('start_date', now()->toDateString());
            $endDate = $request->input('end_date', now()->addMonths(3)->toDateString());

            try {
                $start = Carbon::parse($startDate);
                $end = Carbon::parse($endDate);
            } catch (\Exception $e) {
                Log::warning('Invalid date format in getAvailability', [
                    'start' => $startDate,
                    'end' => $endDate,
                    'error' => $e->getMessage()
                ]);
                return $this->fail('Invalid date format. Use YYYY-MM-DD.', 422);
            }

            if ($start->diffInMonths($end) > 12) {
                $end = $start->copy()->addMonths(12);
            }

            $availability = [];
            $current = clone $start;

            while ($current <= $end) {
                $date = $current->toDateString();

                try {
                    $bookingCount = Booking::whereIn('booking_status', ['confirmed', 'pending_approval'])
                        ->whereHas('serviceEvent', function ($query) use ($date) {
                            $query->whereDate('event_date', $date);
                        })->count();

                    $setting = Setting::where('group', 'booking_calendar')
                        ->where('key', $date)
                        ->first();

                    $status = 'available';
                    $operationMode = 'normal';
                    $maxBookings = null;
                    $notes = null;
                    $isHoliday = false;

                    if ($setting) {
                        try {
                            $value = json_decode($setting->value, true);
                            if (is_array($value)) {
                                $status = $value['status'] ?? 'available';
                                $operationMode = $value['operation_mode'] ?? (!empty($value['max_bookings']) ? 'limited_slot' : 'normal');
                                $maxBookings = $operationMode === 'limited_slot' ? ($value['max_bookings'] ?? null) : null;
                                $notes = $value['notes'] ?? null;
                                $isHoliday = $value['is_holiday'] ?? false;
                            }
                        } catch (\Exception $e) {
                            Log::warning('Failed to decode setting value', [
                                'date' => $date,
                                'value' => $setting->value,
                                'error' => $e->getMessage()
                            ]);
                        }
                    }

                    $isPast = $current->isPast() && !$current->isToday();
                    $isLimitedSlot = $operationMode === 'limited_slot' && $maxBookings !== null;
                    $isAvailable = !$isPast && $status === 'available' && (! $isLimitedSlot || $bookingCount < $maxBookings);

                    $availability[] = [
                        'date' => $date,
                        'status' => $isPast ? 'past' : $status,
                        'operation_mode' => $operationMode,
                        'booking_count' => $bookingCount,
                        'max_bookings' => $maxBookings,
                        'is_available' => $isAvailable,
                        'notes' => $notes,
                        'day_of_week' => $current->format('l'),
                        'formatted' => $current->format('F j, Y'),
                        'is_holiday' => $isHoliday,
                        'is_past' => $isPast,
                        'is_today' => $current->isToday(),
                    ];
                } catch (\Exception $e) {
                    Log::error('Error processing date: ' . $date, [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    $availability[] = [
                        'date' => $date,
                        'status' => 'available',
                        'booking_count' => 0,
                        'operation_mode' => 'normal',
                        'max_bookings' => null,
                        'is_available' => true,
                        'notes' => null,
                        'day_of_week' => $current->format('l'),
                        'formatted' => $current->format('F j, Y'),
                        'is_holiday' => false,
                        'is_past' => $current->isPast() && !$current->isToday(),
                        'is_today' => $current->isToday(),
                    ];
                }

                $current->addDay();
            }

            return $this->ok($availability);
        } catch (\Exception $e) {
            Log::error('Get availability critical error: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            return $this->fail('Failed to get availability: ' . $e->getMessage(), 500);
        }
    }

    public function getAvailableDates(Request $request): JsonResponse
    {
        try {
            $startDate = $request->input('start_date', now()->toDateString());
            $endDate = $request->input('end_date', now()->addMonths(3)->toDateString());

            try {
                $start = Carbon::parse($startDate);
                $end = Carbon::parse($endDate);
            } catch (\Exception $e) {
                return $this->fail('Invalid date format. Use YYYY-MM-DD.', 422);
            }

            if ($start->diffInMonths($end) > 12) {
                $end = $start->copy()->addMonths(12);
            }

            $availableDates = [];
            $current = clone $start;

            while ($current <= $end) {
                $date = $current->toDateString();

                if ($current->isPast() && !$current->isToday()) {
                    $current->addDay();
                    continue;
                }

                try {
                    $setting = Setting::where('group', 'booking_calendar')
                        ->where('key', $date)
                        ->first();

                    $isAvailable = true;
                    $notes = null;

                    if ($setting) {
                        $value = json_decode($setting->value, true);
                        if (is_array($value)) {
                            $status = $value['status'] ?? 'available';
                            $operationMode = $value['operation_mode'] ?? (!empty($value['max_bookings']) ? 'limited_slot' : 'normal');
                            $maxBookings = $operationMode === 'limited_slot' ? ($value['max_bookings'] ?? null) : null;
                            $notes = $value['notes'] ?? null;

                            $bookingCount = Booking::whereIn('booking_status', ['confirmed', 'pending_approval'])
                                ->whereHas('serviceEvent', function ($query) use ($date) {
                                    $query->whereDate('event_date', $date);
                                })->count();

                            $isLimitedSlot = $operationMode === 'limited_slot' && $maxBookings !== null;
                            $isAvailable = $status === 'available' && (! $isLimitedSlot || $bookingCount < $maxBookings);
                        }
                    }

                    if ($isAvailable) {
                        $availableDates[] = [
                            'date' => $date,
                            'day_of_week' => $current->format('l'),
                            'formatted' => $current->format('F j, Y'),
                            'notes' => $notes,
                        ];
                    }
                } catch (\Exception $e) {
                    Log::warning('Error checking availability for date: ' . $date, [
                        'error' => $e->getMessage()
                    ]);
                }

                $current->addDay();
            }

            return $this->ok($availableDates);
        } catch (\Exception $e) {
            Log::error('Get available dates error: ' . $e->getMessage());
            return $this->fail('Failed to get available dates: ' . $e->getMessage(), 500);
        }
    }

    public function getAvailableTimeSlots(Request $request): JsonResponse
    {
        try {
            $date = $request->input('date', now()->toDateString());

            try {
                $dateObj = Carbon::parse($date);
            } catch (\Exception $e) {
                return $this->fail('Invalid date format. Use YYYY-MM-DD.', 422);
            }

            $allSlots = [
                ['value' => '08:00 AM', 'label' => '8:00 AM'],
                ['value' => '09:00 AM', 'label' => '9:00 AM'],
                ['value' => '10:00 AM', 'label' => '10:00 AM'],
                ['value' => '11:00 AM', 'label' => '11:00 AM'],
                ['value' => '12:00 PM', 'label' => '12:00 PM'],
                ['value' => '01:00 PM', 'label' => '1:00 PM'],
                ['value' => '02:00 PM', 'label' => '2:00 PM'],
                ['value' => '03:00 PM', 'label' => '3:00 PM'],
                ['value' => '04:00 PM', 'label' => '4:00 PM'],
                ['value' => '05:00 PM', 'label' => '5:00 PM'],
                ['value' => '06:00 PM', 'label' => '6:00 PM'],
                ['value' => '07:00 PM', 'label' => '7:00 PM'],
                ['value' => '08:00 PM', 'label' => '8:00 PM'],
            ];

            if ($dateObj->isToday()) {
                $currentHour = now()->format('h:i A');
                $allSlots = array_filter($allSlots, function ($slot) use ($currentHour) {
                    return strtotime($slot['value']) > strtotime($currentHour);
                });
                $allSlots = array_values($allSlots);
            }

            if ($dateObj->isPast() && !$dateObj->isToday()) {
                return $this->ok([]);
            }

            $conflictingBookings = Booking::whereIn('booking_status', ['confirmed', 'pending_approval'])
                ->whereHas('serviceEvent', function ($query) use ($date) {
                    $query->whereDate('event_date', $date);
                })->with('serviceEvent')->get();

            $bookedTimes = $conflictingBookings->pluck('serviceEvent.event_time')->filter()->toArray();

            $availableSlots = array_filter($allSlots, function ($slot) use ($bookedTimes) {
                return !in_array($slot['value'], $bookedTimes);
            });

            return $this->ok(array_values($availableSlots));
        } catch (\Exception $e) {
            Log::error('Get time slots error: ' . $e->getMessage());
            return $this->fail('Failed to get time slots: ' . $e->getMessage(), 500);
        }
    }

    public function saveAvailability(Request $request, string $date): JsonResponse
    {
        try {
            try {
                Carbon::parse($date);
            } catch (\Exception $e) {
                return $this->fail('Invalid date format. Use YYYY-MM-DD.', 422);
            }

            $validated = $request->validate([
                'status' => ['required', 'in:available,fully_booked,unavailable'],
                'operation_mode' => ['nullable', 'in:normal,limited_slot'],
                'max_bookings' => ['nullable', 'integer', 'min:1'],
                'notes' => ['nullable', 'string', 'max:2000'],
            ]);

            if (Carbon::parse($date)->isPast() && !Carbon::parse($date)->isToday()) {
                return $this->fail('Cannot edit availability for past dates.', 422);
            }

            $operationMode = $validated['operation_mode'] ?? 'normal';
            if ($validated['status'] !== 'available') {
                $operationMode = 'normal';
            }
            if ($operationMode === 'limited_slot' && empty($validated['max_bookings'])) {
                return $this->fail('Maximum bookings limit is required when Limited Slot mode is selected.', 422);
            }

            $data = [
                'status' => $validated['status'],
                'operation_mode' => $operationMode,
                'max_bookings' => $operationMode === 'limited_slot' ? ($validated['max_bookings'] ?? null) : null,
                'notes' => $validated['notes'] ?? null,
                'updated_at' => now()->toDateTimeString(),
            ];

            Setting::updateOrCreate(
                ['group' => 'booking_calendar', 'key' => $date],
                ['value' => json_encode($data), 'type' => 'json']
            );

            $this->logCustom(
                'availability_update',
                'settings',
                null,
                "Calendar availability updated for {$date}",
                [
                    'date' => $date,
                    'status' => $validated['status'],
                    'operation_mode' => $operationMode,
                    'max_bookings' => $data['max_bookings'] ?? null,
                    'updated_at' => now()->toDateTimeString()
                ]
            );

            return $this->ok(null, 'Calendar availability saved.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Save availability error: ' . $e->getMessage());
            return $this->fail('Failed to save availability: ' . $e->getMessage(), 500);
        }
    }

    public function deleteAvailability(string $date): JsonResponse
    {
        try {
            try {
                Carbon::parse($date);
            } catch (\Exception $e) {
                return $this->fail('Invalid date format. Use YYYY-MM-DD.', 422);
            }

            if (Carbon::parse($date)->isPast() && !Carbon::parse($date)->isToday()) {
                return $this->fail('Cannot reset availability for past dates.', 422);
            }

            Setting::where('group', 'booking_calendar')->where('key', $date)->delete();

            $this->logCustom(
                'availability_reset',
                'settings',
                null,
                "Calendar availability reset for {$date}",
                ['date' => $date, 'reset_at' => now()->toDateTimeString()]
            );

            return $this->ok(null, 'Calendar availability reset.');
        } catch (\Exception $e) {
            Log::error('Delete availability error: ' . $e->getMessage());
            return $this->fail('Failed to reset availability: ' . $e->getMessage(), 500);
        }
    }

    public function createOrder(Booking $booking, BookingService $service): JsonResponse
    {
        try {
            $booking = $service->approve($booking);

            $this->logCustom(
                'order_created',
                'orders',
                $booking->order?->order_id,
                "Order #{$booking->order?->order_number} created from booking {$booking->booking_no}",
                [
                    'booking_no' => $booking->booking_no,
                    'order_number' => $booking->order?->order_number,
                    'created_at' => now()->toDateTimeString()
                ]
            );

            return $this->ok($booking->order, 'Order created.');
        } catch (\Exception $e) {
            Log::error('Create order error: ' . $e->getMessage());
            return $this->fail('Failed to create order: ' . $e->getMessage(), 500);
        }
    }

    public function complete(Booking $booking, BookingService $service): JsonResponse
    {
        try {
            $booking->loadMissing([
                'serviceEvent.customer.person',
                'payments',
                'invoice',
                'quotation',
                'order',
                'equipment.equipment',
            ]);

            $completionCheck = $this->validateBookingCompletion($booking);
            if (! $completionCheck['can_complete']) {
                return $this->fail(
                    'Cannot complete this booking. ' . implode(' ', $completionCheck['missing']),
                    422
                );
            }

            $oldData = $booking->toArray();

            app(\App\Services\EventService::class)->completeEvent(
                $booking,
                true,
                [
                    'debt_booking_event' => false,
                    'outstanding_balance' => 0,
                    'approved_by' => auth()->id(),
                    'approved_at' => now()->toDateTimeString(),
                ]
            );

            $this->logCustom(
                'complete',
                'bookings',
                $booking->booking_id,
                "Booking {$booking->booking_no} marked as COMPLETED",
                [
                    'booking_no' => $booking->booking_no,
                    'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'old_status' => $oldData['booking_status'] ?? 'pending',
                    'new_status' => 'completed',
                    'completed_at' => now()->toDateTimeString(),
                    'inventory_deduction' => 'Handled by EventService; duplicate deductions are prevented.'
                ]
            );

            $customer = $booking->serviceEvent?->customer;
            if ($customer && $customer->user_id) {
                $notificationService = app(NotificationService::class);
                $notificationService->notifyUser(
                    $customer->user_id,
                    'event_completed',
                    'Event Completed',
                    "Your event {$booking->booking_no} has been completed successfully. Thank you for choosing us!",
                    \App\Models\Notification::PRIORITY_HIGH,
                    ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                    "/customer/bookings/{$booking->booking_id}"
                );
            }

            $notificationService = app(NotificationService::class);
            $notificationService->notifyRole(
                'admin',
                'event_completed',
                '🎉 Event Completed',
                "Event for booking {$booking->booking_no} has been marked as completed.",
                \App\Models\Notification::PRIORITY_MEDIUM,
                ['booking_id' => $booking->booking_id, 'booking_no' => $booking->booking_no],
                "/admin/events"
            );

            return $this->ok(
                $this->formatBooking($booking->fresh()),
                'Booking marked as completed.'
            );
        } catch (\Exception $e) {
            Log::error('Complete booking error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to complete booking: ' . $e->getMessage(), 500);
        }
    }

    public function createEvent(Booking $booking): JsonResponse
    {
        try {
            $event = $booking->serviceEvent;
            if (!$event) {
                return $this->fail('No service event found for this booking', 422);
            }

            $tracking = EventTracking::create([
                'booking_id' => $booking->booking_id,
                'stage' => 'preparation',
                'progress_percentage' => 0,
                'stage_started_at' => now(),
                'notes' => json_encode([
                    'created_from_booking' => $booking->booking_no,
                    'created_at' => now()->toIso8601String(),
                ]),
            ]);

            return $this->ok([
                'booking_id' => $booking->booking_id,
                'event' => $event,
                'tracking' => $tracking,
            ], 'Event created successfully');
        } catch (\Exception $e) {
            Log::error('Create event error: ' . $e->getMessage());
            return $this->fail('Failed to create event: ' . $e->getMessage(), 500);
        }
    }

    public function cancelWithReason(Request $request, Booking $booking): JsonResponse
    {
        try {
            $validated = $request->validate([
                'reason' => ['required', 'string', 'max:500'],
            ]);

            $oldData = $booking->toArray();
            $reason = $validated['reason'] ?? null;

            $booking->update([
                'booking_status' => 'cancelled',
                'cancellation_reason' => $reason,
            ]);

            if ($booking->serviceEvent) {
                $booking->serviceEvent->update(['status' => 'cancelled']);
            }

            foreach ($booking->items as $item) {
                if (!$item->menu_item_id) continue;
                foreach ($item->menuItem->recipeIngredients as $recipe) {
                    $stock = InventoryStock::where('ingredient_id', $recipe->ingredient_id)->first();
                    if ($stock) {
                        $requiredQty = $recipe->quantity_per_pax * $item->quantity;
                        $stock->decrement('reserved_quantity', $requiredQty);
                    }
                }
            }

            Setting::where('group', 'calendar_events')
                ->where('key', 'booking_' . $booking->booking_id)
                ->delete();

            $this->logCustom(
                'cancel_with_reason',
                'bookings',
                $booking->booking_id,
                "Booking {$booking->booking_no} CANCELLED with reason",
                [
                    'booking_no' => $booking->booking_no,
                    'customer' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'reason' => $reason,
                    'old_status' => $oldData['booking_status'] ?? 'pending',
                    'new_status' => 'cancelled',
                    'cancelled_at' => now()->toDateTimeString()
                ]
            );

            $notificationService = app(NotificationService::class);
            $notificationService->bookingCancelled($booking, $reason);

            return $this->ok(
                $this->formatBooking($booking->fresh()),
                'Booking cancelled.'
            );
        } catch (\Exception $e) {
            Log::error('Cancel with reason error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return $this->fail('Failed to cancel booking: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get all bookings with ingredients summary organized by booking
     */
    public function getBookingsWithIngredients(Request $request): JsonResponse
    {
        try {
            $bookings = Booking::with([
                'serviceEvent.customer.person',
                'serviceEvent.eventType',
                'items.menuItem.recipeIngredients.ingredient.stock',
            ])
                ->whereIn('booking_status', ['confirmed', 'pending_approval'])
                ->latest('booking_id')
                ->get();

            $result = [];

            foreach ($bookings as $booking) {
                $guestsCount = (int) ($booking->serviceEvent?->guests_count ?? 0);
                $allIngredients = [];
                $menuItems = [];

                foreach ($booking->items as $item) {
                    if (!$item->menu_item_id) continue;

                    $menuItem = $item->menuItem;
                    if (!$menuItem) continue;

                    $itemIngredients = [];

                    foreach ($menuItem->recipeIngredients as $recipe) {
                        $stock = InventoryStock::where('ingredient_id', $recipe->ingredient_id)->first();
                        $quantityNeeded = $recipe->quantity_per_pax * max(1, (int) $item->quantity);
                        $availableStock = ($stock?->current_quantity ?? 0) - ($stock?->reserved_quantity ?? 0);
                        $shortage = max(0, $quantityNeeded - $availableStock);

                        $purchased = PurchaseRequest::where('ingredient_id', $recipe->ingredient_id)
                            ->where('booking_id', $booking->booking_id)
                            ->whereIn('status', ['received', 'purchased'])
                            ->exists();

                        $ingredientData = [
                            'ingredient_id' => $recipe->ingredient_id,
                            'name' => $recipe->ingredient?->name ?? 'Unknown',
                            'unit' => $recipe->unit ?? $recipe->ingredient?->unit ?? 'kg',
                            'per_pax' => (float) $recipe->quantity_per_pax,
                            'quantity_needed' => round($quantityNeeded, 2),
                            'current_stock' => (float) ($stock?->current_quantity ?? 0),
                            'reserved_quantity' => (float) ($stock?->reserved_quantity ?? 0),
                            'available_stock' => round($availableStock, 2),
                            'shortage' => round($shortage, 2),
                            'purchased' => $purchased,
                            'need_to_buy' => !$purchased && $shortage > 0,
                            'unit_cost' => (float) ($recipe->ingredient?->unit_cost ?? 0),
                        ];

                        $itemIngredients[] = $ingredientData;
                        $allIngredients[] = $ingredientData;
                    }

                    $menuItems[] = [
                        'menu_item_id' => $menuItem->menu_item_id,
                        'name' => $menuItem->name,
                        'quantity' => $item->quantity,
                        'price' => (float) $item->unit_price,
                        'ingredients' => $itemIngredients,
                        'ingredients_summary' => [
                            'total' => count($itemIngredients),
                            'need_to_buy' => collect($itemIngredients)->where('need_to_buy', true)->count(),
                            'purchased' => collect($itemIngredients)->where('purchased', true)->count(),
                            'total_shortage' => collect($itemIngredients)->sum('shortage'),
                        ]
                    ];
                }

                // Deduplicate all ingredients
                $uniqueIngredients = [];
                foreach ($allIngredients as $ing) {
                    $key = $ing['ingredient_id'];
                    if (!isset($uniqueIngredients[$key])) {
                        $uniqueIngredients[$key] = $ing;
                    } else {
                        $uniqueIngredients[$key]['quantity_needed'] += $ing['quantity_needed'];
                        $uniqueIngredients[$key]['shortage'] = max(
                            0,
                            $uniqueIngredients[$key]['quantity_needed'] - $uniqueIngredients[$key]['available_stock']
                        );
                        $uniqueIngredients[$key]['need_to_buy'] = $uniqueIngredients[$key]['shortage'] > 0;
                    }
                }
                $allIngredients = array_values($uniqueIngredients);

                $result[] = [
                    'booking_id' => $booking->booking_id,
                    'booking_no' => $booking->booking_no,
                    'booking_status' => $booking->booking_status,
                    'customer_name' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'customer_email' => $booking->serviceEvent?->customer?->person?->email,
                    'customer_phone' => $booking->serviceEvent?->customer?->person?->phone,
                    'event_date' => $booking->serviceEvent?->event_date?->toDateString(),
                    'event_time' => $booking->serviceEvent?->event_time,
                    'venue' => $booking->serviceEvent?->venue,
                    'guests_count' => $guestsCount,
                    'menu_items' => $menuItems,
                    'ingredients_summary' => [
                        'total_ingredients' => count($allIngredients),
                        'need_to_buy' => collect($allIngredients)->where('need_to_buy', true)->count(),
                        'purchased' => collect($allIngredients)->where('purchased', true)->count(),
                        'total_shortage' => collect($allIngredients)->sum('shortage'),
                    ],
                    'all_ingredients' => $allIngredients,
                ];
            }

            // Apply search filter
            if ($request->filled('search')) {
                $search = strtolower($request->input('search'));
                $result = array_filter($result, function ($booking) use ($search) {
                    return str_contains(strtolower($booking['booking_no']), $search)
                        || str_contains(strtolower($booking['customer_name']), $search);
                });
                $result = array_values($result);
            }

            $perPage = $request->integer('per_page', 10);
            if ($perPage < 1) {
                $perPage = 10;
            }
            if ($perPage > 1000) {
                $perPage = 100;
            }

            $page = $request->integer('page', 1);
            if ($page < 1) {
                $page = 1;
            }

            $total = count($result);
            $lastPage = max(1, ceil($total / $perPage));

            if ($page > $lastPage) {
                $page = $lastPage;
            }

            $offset = ($page - 1) * $perPage;
            $paginated = array_slice($result, $offset, $perPage);

            return response()->json([
                'success' => true,
                'data' => [
                    'data' => $paginated,
                    'total' => $total,
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'last_page' => $lastPage,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get bookings with ingredients error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load ingredients data: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get detailed ingredients for a specific booking
     */
    public function getBookingIngredientsDetails(Booking $booking): JsonResponse
    {
        try {
            $booking->load([
                'serviceEvent.customer.person',
                'serviceEvent.eventType',
                'items.menuItem.recipeIngredients.ingredient.stock',
            ]);

            $guestsCount = (int) ($booking->serviceEvent?->guests_count ?? 0);
            $allIngredients = [];
            $menuItems = [];

            foreach ($booking->items as $item) {
                if (!$item->menu_item_id) continue;

                $menuItem = $item->menuItem;
                if (!$menuItem) continue;

                $itemIngredients = [];

                foreach ($menuItem->recipeIngredients as $recipe) {
                    $stock = InventoryStock::where('ingredient_id', $recipe->ingredient_id)->first();
                    $quantityNeeded = $recipe->quantity_per_pax * max(1, (int) $item->quantity);
                    $availableStock = ($stock?->current_quantity ?? 0) - ($stock?->reserved_quantity ?? 0);
                    $shortage = max(0, $quantityNeeded - $availableStock);

                    $purchased = PurchaseRequest::where('ingredient_id', $recipe->ingredient_id)
                        ->where('booking_id', $booking->booking_id)
                        ->whereIn('status', ['received', 'purchased'])
                        ->exists();

                    $ingredientData = [
                        'ingredient_id' => $recipe->ingredient_id,
                        'name' => $recipe->ingredient?->name ?? 'Unknown',
                        'unit' => $recipe->unit ?? $recipe->ingredient?->unit ?? 'kg',
                        'per_pax' => (float) $recipe->quantity_per_pax,
                        'quantity_needed' => round($quantityNeeded, 2),
                        'current_stock' => (float) ($stock?->current_quantity ?? 0),
                        'reserved_quantity' => (float) ($stock?->reserved_quantity ?? 0),
                        'available_stock' => round($availableStock, 2),
                        'shortage' => round($shortage, 2),
                        'purchased' => $purchased,
                        'need_to_buy' => !$purchased && $shortage > 0,
                        'unit_cost' => (float) ($recipe->ingredient?->unit_cost ?? 0),
                        'menu_items' => [
                            [
                                'name' => $menuItem->name,
                                'quantity' => $item->quantity,
                                'per_pax' => $recipe->quantity_per_pax,
                                'required' => round($quantityNeeded, 2),
                            ]
                        ],
                    ];

                    $itemIngredients[] = $ingredientData;
                    $allIngredients[] = $ingredientData;
                }

                $menuItems[] = [
                    'menu_item_id' => $menuItem->menu_item_id,
                    'name' => $menuItem->name,
                    'quantity' => $item->quantity,
                    'price' => (float) $item->unit_price,
                    'ingredients' => $itemIngredients,
                    'ingredients_summary' => [
                        'total' => count($itemIngredients),
                        'need_to_buy' => collect($itemIngredients)->where('need_to_buy', true)->count(),
                        'purchased' => collect($itemIngredients)->where('purchased', true)->count(),
                        'total_shortage' => collect($itemIngredients)->sum('shortage'),
                    ]
                ];
            }

            // Deduplicate all ingredients
            $uniqueIngredients = [];
            foreach ($allIngredients as $ing) {
                $key = $ing['ingredient_id'];
                if (!isset($uniqueIngredients[$key])) {
                    $uniqueIngredients[$key] = $ing;
                } else {
                    $uniqueIngredients[$key]['quantity_needed'] += $ing['quantity_needed'];
                    $uniqueIngredients[$key]['shortage'] = max(
                        0,
                        $uniqueIngredients[$key]['quantity_needed'] - $uniqueIngredients[$key]['available_stock']
                    );
                    $uniqueIngredients[$key]['need_to_buy'] = $uniqueIngredients[$key]['shortage'] > 0;
                    $uniqueIngredients[$key]['menu_items'] = array_merge(
                        $uniqueIngredients[$key]['menu_items'] ?? [],
                        $ing['menu_items'] ?? []
                    );
                }
            }
            $allIngredients = array_values($uniqueIngredients);

            return response()->json([
                'success' => true,
                'data' => [
                    'booking_id' => $booking->booking_id,
                    'booking_no' => $booking->booking_no,
                    'booking_status' => $booking->booking_status,
                    'customer_name' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'customer_email' => $booking->serviceEvent?->customer?->person?->email,
                    'customer_phone' => $booking->serviceEvent?->customer?->person?->phone,
                    'event_date' => $booking->serviceEvent?->event_date?->toDateString(),
                    'event_time' => $booking->serviceEvent?->event_time,
                    'venue' => $booking->serviceEvent?->venue,
                    'guests_count' => $guestsCount,
                    'menu_items' => $menuItems,
                    'ingredients_summary' => [
                        'total_ingredients' => count($allIngredients),
                        'need_to_buy' => collect($allIngredients)->where('need_to_buy', true)->count(),
                        'purchased' => collect($allIngredients)->where('purchased', true)->count(),
                        'total_shortage' => collect($allIngredients)->sum('shortage'),
                    ],
                    'all_ingredients' => $allIngredients,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get booking ingredients details error: ' . $e->getMessage(), [
                'booking_id' => $booking->booking_id,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load ingredients details: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get ingredients for a specific menu item within a booking
     */
    public function getMenuItemIngredients(Booking $booking, $menuItemId): JsonResponse
    {
        try {
            $menuItem = MenuItem::find($menuItemId);
            if (!$menuItem) {
                return response()->json([
                    'success' => false,
                    'message' => 'Menu item not found',
                ], 404);
            }

            $booking->loadMissing(['serviceEvent', 'items']);
            $guestsCount = (int) ($booking->serviceEvent?->guests_count ?? 0);
            $servingQuantity = (int) $booking->items
                ->where('menu_item_id', (int) $menuItemId)
                ->sum('quantity');
            if ($servingQuantity <= 0) {
                $servingQuantity = max(1, $guestsCount);
            }
            $ingredients = [];

            foreach ($menuItem->recipeIngredients as $recipe) {
                $stock = InventoryStock::where('ingredient_id', $recipe->ingredient_id)->first();
                $quantityNeeded = $recipe->quantity_per_pax * $servingQuantity;
                $availableStock = ($stock?->current_quantity ?? 0) - ($stock?->reserved_quantity ?? 0);
                $shortage = max(0, $quantityNeeded - $availableStock);

                $purchased = PurchaseRequest::where('ingredient_id', $recipe->ingredient_id)
                    ->where('booking_id', $booking->booking_id)
                    ->whereIn('status', ['received', 'purchased'])
                    ->exists();

                $ingredients[] = [
                    'ingredient_id' => $recipe->ingredient_id,
                    'name' => $recipe->ingredient?->name ?? 'Unknown',
                    'unit' => $recipe->unit ?? $recipe->ingredient?->unit ?? 'kg',
                    'per_pax' => (float) $recipe->quantity_per_pax,
                    'quantity_needed' => round($quantityNeeded, 2),
                    'current_stock' => (float) ($stock?->current_quantity ?? 0),
                    'reserved_quantity' => (float) ($stock?->reserved_quantity ?? 0),
                    'available_stock' => round($availableStock, 2),
                    'shortage' => round($shortage, 2),
                    'purchased' => $purchased,
                    'need_to_buy' => !$purchased && $shortage > 0,
                    'unit_cost' => (float) ($recipe->ingredient?->unit_cost ?? 0),
                ];
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'menu_item_id' => $menuItem->menu_item_id,
                    'menu_item_name' => $menuItem->name,
                    'guests_count' => $guestsCount,
                    'ingredients' => $ingredients,
                    'summary' => [
                        'total_ingredients' => count($ingredients),
                        'need_to_buy' => collect($ingredients)->where('need_to_buy', true)->count(),
                        'purchased' => collect($ingredients)->where('purchased', true)->count(),
                        'total_shortage' => collect($ingredients)->sum('shortage'),
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Get menu item ingredients error: ' . $e->getMessage(), [
                'booking_id' => $booking->booking_id,
                'menu_item_id' => $menuItemId,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to load menu item ingredients: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mark ingredients as purchased for a booking
     */
    public function markIngredientsPurchasedPerBooking(Request $request, Booking $booking): JsonResponse
    {
        try {
            $data = $request->validate([
                'ingredient_ids' => 'required|array',
                'ingredient_ids.*' => 'exists:ingredients,ingredient_id',
                'menu_item_id' => 'nullable|exists:menu_items,menu_item_id',
            ]);

            $updated = 0;
            $ingredientNames = [];
            $menuItemName = null;

            if ($data['menu_item_id'] ?? false) {
                $menuItem = MenuItem::find($data['menu_item_id']);
                $menuItemName = $menuItem?->name;
            }

            foreach ($data['ingredient_ids'] as $ingredientId) {
                $existingRequest = PurchaseRequest::where('ingredient_id', $ingredientId)
                    ->where('booking_id', $booking->booking_id)
                    ->where('status', 'pending')
                    ->first();

                if ($existingRequest) {
                    $existingRequest->update(['status' => 'received']);
                    $updated++;
                } else {
                    $setting = Setting::where('group', 'ingredients_summary')
                        ->where('key', 'booking_' . $booking->booking_id)
                        ->first();

                    $ingredients = $setting ? $this->decodeSettingValue($setting->value) : [];
                    $found = collect($ingredients)->firstWhere('ingredient_id', $ingredientId);

                    if ($found && ($found['shortage'] ?? 0) > 0) {
                        PurchaseRequest::create([
                            'pr_number' => 'PRQ-' . now()->format('YmdHis') . '-' . random_int(100, 999),
                            'ingredient_id' => $ingredientId,
                            'quantity' => $found['shortage'],
                            'urgency' => 'normal',
                            'status' => 'received',
                            'notes' => "Marked as purchased for booking {$booking->booking_no}" .
                                ($menuItemName ? " (Menu: {$menuItemName})" : ''),
                            'requested_by' => auth()->id() ?? 1,
                            'booking_id' => $booking->booking_id,
                        ]);
                        $updated++;
                    }
                }

                $ingredient = Ingredient::find($ingredientId);
                if ($ingredient) {
                    $ingredientNames[] = $ingredient->name;
                }
            }

            // Update settings
            $setting = Setting::where('group', 'ingredients_summary')
                ->where('key', 'booking_' . $booking->booking_id)
                ->first();

            if ($setting) {
                $ingredients = $this->decodeSettingValue($setting->value);
                foreach ($ingredients as &$ing) {
                    if (in_array($ing['ingredient_id'], $data['ingredient_ids'])) {
                        $ing['purchased'] = true;
                    }
                }
                $setting->update(['value' => json_encode($ingredients)]);
            }

            $message = $menuItemName
                ? "{$updated} ingredients marked as purchased for {$menuItemName}"
                : "{$updated} ingredients marked as purchased";

            return response()->json([
                'success' => true,
                'data' => [
                    'updated' => $updated,
                    'ingredients' => $ingredientNames,
                    'menu_item_name' => $menuItemName,
                    'total_selected' => count($data['ingredient_ids']),
                ],
                'message' => $message
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Mark ingredients purchased error: ' . $e->getMessage(), [
                'booking_id' => $booking->booking_id,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to mark ingredients: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Mark all ingredients for a booking as purchased
     */
    public function markAllIngredientsPurchased(Booking $booking): JsonResponse
    {
        try {
            $setting = Setting::where('group', 'ingredients_summary')
                ->where('key', 'booking_' . $booking->booking_id)
                ->first();

            $ingredients = $setting ? $this->decodeSettingValue($setting->value) : [];
            $needToBuy = array_filter($ingredients, function ($ing) {
                return ($ing['need_to_buy'] ?? false) === true;
            });

            if (empty($needToBuy)) {
                return response()->json([
                    'success' => true,
                    'message' => 'All ingredients are already purchased or sufficiently stocked.',
                ]);
            }

            $ingredientIds = array_column($needToBuy, 'ingredient_id');

            $request = new Request([
                'ingredient_ids' => $ingredientIds,
            ]);

            return $this->markIngredientsPurchasedPerBooking($request, $booking);
        } catch (\Exception $e) {
            Log::error('Mark all ingredients purchased error: ' . $e->getMessage(), [
                'booking_id' => $booking->booking_id,
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to mark all ingredients: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getIngredientsSummary(Booking $booking): JsonResponse
    {
        return $this->getBookingIngredientsDetails($booking);
    }

    public function markIngredientsPurchased(Request $request, Booking $booking): JsonResponse
    {
        return $this->markIngredientsPurchasedPerBooking($request, $booking);
    }

    public function getCompleted(Request $request): JsonResponse
    {
        $request->merge(['status' => 'completed']);
        return $this->index($request);
    }

    // ============================================================
    // PRIVATE HELPER METHODS
    // ============================================================

    private function validateBookingCompletion(Booking $booking): array
    {
        $booking->loadMissing(['payments', 'invoice', 'quotation', 'equipment.equipment', 'order', 'serviceEvent']);
        $missing = [];

        $payments = $this->loadedRelationCollection($booking, 'payments');
        $equipment = $this->loadedRelationCollection($booking, 'equipment');

        $totalAmount = (float) ($booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0);
        $additionalCharges = 0.0;
        if ($booking->invoice) {
            $additionalCharges += (float) ($booking->invoice->additional_charges ?? 0);
        }
        if ($booking->relationLoaded('charges')) {
            $additionalCharges += (float) $booking->charges->where('charge_kind', 'charge')->sum('amount');
        } elseif (Schema::hasTable('booking_charges')) {
            $additionalCharges += (float) DB::table('booking_charges')
                ->where('booking_id', $booking->booking_id)
                ->where('charge_kind', 'charge')
                ->sum('amount');
        }

        $damageAmount = (float) $equipment->sum(fn($item) => (float) ($item->damage_charge ?? 0) + (float) ($item->missing_charge ?? 0));
        $paidAmount = (float) $payments->where('status', 'completed')->sum('amount');
        $requiredPayment = $totalAmount;

        if ($totalAmount > 0 && $paidAmount + 0.01 < $requiredPayment) {
            $missing[] = 'Please pay the remaining balance before completing this booking.';
        }

        $notReturned = $equipment->filter(fn($equipmentRow) => ! in_array($equipmentRow->status, ['returned'], true));
        if ($notReturned->count() > 0) {
            $missing[] = 'Equipment return is not yet complete.';
        }

        $hasDamageOrMissing = $equipment->filter(fn($row) => ((int) ($row->quantity_damaged ?? 0) > 0) || ((int) ($row->quantity_missing ?? 0) > 0))->count() > 0;
        if ($hasDamageOrMissing && $damageAmount > 0 && $paidAmount + 0.01 < ($totalAmount + $damageAmount + $additionalCharges)) {
            $missing[] = 'Damage or missing equipment charges must be paid.';
        }

        $ingredients = $this->bookingIngredients($booking);
        $unpurchased = collect($ingredients)->filter(fn($ingredient) => ($ingredient['need_to_buy'] ?? false) && !($ingredient['purchased'] ?? false));
        if ($unpurchased->count() > 0) {
            $missing[] = 'Please complete ingredients purchase first.';
        }

        $order = $booking->order;
        if ($order) {
            $metadata = $this->orderMetadata($order);
            $kitchenTasks = $metadata['kitchen_preparation'] ?? $this->settingArray('kitchen_tasks', 'order_' . $order->order_id);
            $kitchenPending = collect($kitchenTasks)->filter(function ($task) {
                if (($task['is_header'] ?? false) === true) return false;
                return ! (($task['is_done'] ?? false) || (($task['status'] ?? 'pending') === 'completed'));
            });
            if ($kitchenPending->count() > 0) {
                $missing[] = 'Kitchen preparation checklist is not yet done.';
            }

            $deliveryItems = $metadata['delivery_preparation'] ?? $this->settingArray('delivery_items', 'order_' . $order->order_id);
            $needsDeliveryPrep = in_array(strtolower((string) $booking->serviceEvent?->delivery_method), ['delivery', 'buffet', 'setup'], true)
                || in_array(strtolower((string) $booking->serviceEvent?->service_type), ['buffet', 'tray'], true);
            if ($needsDeliveryPrep && count($deliveryItems) === 0) {
                $missing[] = 'Delivery preparation items are not added yet.';
            }
            $deliveryPending = collect($deliveryItems)->filter(function ($item) {
                return ! (($item['is_ready'] ?? false) || in_array(($item['status'] ?? 'pending'), ['ready', 'delivered', 'completed'], true));
            });
            if ($deliveryPending->count() > 0) {
                $missing[] = 'Delivery preparation checklist is not yet complete.';
            }
        } else {
            $missing[] = 'Order record is missing.';
        }

        return [
            'can_complete' => empty($missing),
            'missing' => array_values(array_unique($missing)),
        ];
    }

    private function bookingIngredients(Booking $booking): array
    {
        $ingredients = $this->settingArray('ingredients_summary', 'booking_' . $booking->booking_id);
        if (empty($ingredients)) {
            $ingredients = $this->computeIngredientsFromBooking($booking);
            if (!empty($ingredients)) {
                Setting::setValue('ingredients_summary', 'booking_' . $booking->booking_id, $ingredients, 'json');
            }
        }
        return $ingredients;
    }

    private function orderMetadata($order): array
    {
        if (!$order) return [];
        return $this->settingArray('order_metadata', 'order_' . $order->order_id);
    }

    private function settingArray(string $group, string $key): array
    {
        $setting = Setting::where('group', $group)->where('key', $key)->first();
        if (!$setting) return [];
        return $this->decodeSettingValue($setting->value);
    }

    private function decodeSettingValue($value): array
    {
        if (is_array($value)) return $value;
        if (is_object($value)) return (array) $value;
        $decoded = json_decode((string) $value, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function computeIngredientsFromBooking(Booking $booking): array
    {
        $ingredients = [];
        $booking->loadMissing(['items.menuItem.recipeIngredients.ingredient']);

        foreach ($booking->items as $item) {
            if (!$item->menu_item_id) continue;

            $menuItem = $item->menuItem;
            if (!$menuItem) continue;

            foreach ($menuItem->recipeIngredients as $recipe) {
                $ingredientId = $recipe->ingredient_id;
                $quantityPerPax = (float)$recipe->quantity_per_pax;
                $requiredQty = $quantityPerPax * $item->quantity;

                if (!isset($ingredients[$ingredientId])) {
                    $stock = InventoryStock::where('ingredient_id', $ingredientId)->first();
                    $ingredient = Ingredient::find($ingredientId);

                    $ingredients[$ingredientId] = [
                        'ingredient_id' => $ingredientId,
                        'name' => $ingredient?->name ?? 'Unknown',
                        'unit' => $recipe->unit ?? $ingredient?->unit ?? 'kg',
                        'per_pax' => $quantityPerPax,
                        'quantity_needed' => 0,
                        'current_stock' => $stock?->current_quantity ?? 0,
                        'reserved_quantity' => $stock?->reserved_quantity ?? 0,
                        'available_stock' => ($stock?->current_quantity ?? 0) - ($stock?->reserved_quantity ?? 0),
                        'unit_cost' => $ingredient?->unit_cost ?? 0,
                        'menu_items' => [],
                        'purchased' => false,
                    ];
                }

                $ingredients[$ingredientId]['quantity_needed'] += $requiredQty;
                $ingredients[$ingredientId]['menu_items'][] = [
                    'name' => $menuItem->name,
                    'quantity' => $item->quantity,
                    'per_pax' => $quantityPerPax,
                    'required' => $requiredQty,
                ];
            }
        }

        foreach ($ingredients as &$ing) {
            $ing['shortage'] = max(0, $ing['quantity_needed'] - $ing['available_stock']);
            $ing['need_to_buy'] = $ing['shortage'] > 0;
            $ing['status'] = $ing['shortage'] > 0 ? 'insufficient' : ($ing['available_stock'] < $ing['quantity_needed'] * 1.2 ? 'low' : 'sufficient');
        }

        return array_values($ingredients);
    }

    private function formatBooking(Booking $booking): array
    {
        $booking->loadMissing($this->bookingRelations());

        $event = $booking->serviceEvent;
        $person = $event?->customer?->person;

        $startDate = $event?->event_date?->toDateString();
        $endDate = $event?->event_end_date?->toDateString() ?: $startDate;
        $days = 1;
        if ($startDate && $endDate) {
            $days = max(1, Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)) + 1);
        }
        $eventDayRowsForMax = $this->loadedRelationCollection($booking, 'eventDays');
        $mealMaxDay = (int) ($eventDayRowsForMax->max('day_number') ?? 1);
        $days = max($days, $mealMaxDay);
        $isMultiDay = ($event?->booking_scope === 'multi_day') || $days > 1;

        $totalAmount = (float) ($booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0);
        $payments = $this->loadedRelationCollection($booking, 'payments');
        $bookingItems = $this->loadedRelationCollection($booking, 'items');
        $eventDayRows = $this->loadedRelationCollection($booking, 'eventDays');
        $mealServiceRows = $this->loadedRelationCollection($booking, 'mealServices');
        $chargeRows = $this->loadedRelationCollection($booking, 'charges');
        $equipmentRows = $this->loadedRelationCollection($booking, 'equipment');
        $trackingRows = $this->loadedRelationCollection($booking, 'tracking');
        $paidAmount = (float) $payments->where('status', 'completed')->sum('amount');
        $preparationTracking = $trackingRows->where('stage', 'preparation')->first();
        $preparationMetadata = json_decode((string) ($preparationTracking?->notes ?? '[]'), true);
        $preparationMetadata = is_array($preparationMetadata) ? $preparationMetadata : [];
        $assignedStaff = collect($preparationMetadata['assigned_staff'] ?? [])->values();
        $completedTracking = $trackingRows->where('stage', 'completed')->first();
        $completionMetadata = json_decode((string) ($completedTracking?->notes ?? '[]'), true);
        $completionMetadata = is_array($completionMetadata) ? $completionMetadata : [];
        $ongoingTracking = $trackingRows->where('stage', 'ongoing')->first();
        $ongoingMetadata = json_decode((string) ($ongoingTracking?->notes ?? '[]'), true);
        $ongoingMetadata = is_array($ongoingMetadata) ? $ongoingMetadata : [];
        $mealServices = $mealServiceRows->map(fn($meal) => [
            'meal_service_id' => $meal->meal_service_id,
            'id' => $meal->meal_service_id,
            'event_day_id' => $meal->event_day_id,
            'day_number' => (int) $meal->day_number,
            'service_date' => $meal->service_date?->toDateString(),
            'date' => $meal->service_date?->toDateString(),
            'meal_type' => $meal->meal_type,
            'serving_time' => $meal->serving_time,
            'preparation_time' => $meal->preparation_time,
            'dispatch_time' => $meal->dispatch_time,
            'arrival_time' => $meal->arrival_time,
            'pax' => (int) $meal->pax,
            'menu_source' => $meal->menu_source,
            'menu_item_id' => $meal->menu_item_id,
            'package_id' => $meal->package_id,
            'menu_name' => $meal->menu_name,
            'menu_description' => $meal->menu_description,
            'price_per_head' => (float) $meal->price_per_head,
            'total_meal_amount' => (float) $meal->total_meal_amount,
            'filters' => ($meal->relationLoaded('filters') ? $meal->filters : collect())->map(fn($filter) => [
                'filter_key' => $filter->filter_key,
                'filter_value' => $filter->filter_value,
            ])->values(),
            'custom_items' => ($meal->relationLoaded('customItems') ? $meal->customItems : collect())->map(fn($item) => [
                'meal_service_custom_item_id' => $item->meal_service_custom_item_id,
                'menu_item_id' => $item->menu_item_id,
                'item_name' => $item->item_name ?? $item->menuItem?->name,
                'description' => $item->description,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'notes' => $item->notes,
            ])->values(),
            'notes' => $meal->notes,
            'preparation_status' => $meal->preparation_status,
            'delivery_status' => $meal->delivery_status,
            'serving_status' => $meal->serving_status,
            'meal_status' => $meal->meal_status,
        ])->values();
        $eventDays = $eventDayRows->map(fn($day) => [
            'event_day_id' => $day->event_day_id,
            'day_number' => (int) $day->day_number,
            'date' => $day->date?->toDateString(),
            'day_status' => $day->day_status,
            'day_total_amount' => (float) $day->day_total_amount,
        ])->values();

        return [
            'id' => $booking->booking_id,
            'booking_id' => $booking->booking_id,
            'booking_no' => $booking->booking_no,
            'booking_status' => $booking->booking_status,
            'customer_name' => trim(($person?->first_name ?? '') . ' ' . ($person?->last_name ?? '')),
            'customer_email' => $person?->email,
            'customer_phone' => $person?->phone,
            'customer_address' => $person?->address_line_1,
            'address_line_1' => $person?->address_line_1,
            'city' => $person?->city,
            'province' => $person?->province,
            'postal_code' => $person?->postal_code,
            'country' => $person?->country,
            'requested_date' => $booking->booking_status === 'reschedule_requested' ? ($booking->requested_date?->toDateString() ?? null) : null,
            'requested_time' => $booking->booking_status === 'reschedule_requested' ? $booking->requested_time : null,
            'reschedule_reason' => $booking->booking_status === 'reschedule_requested' ? $booking->reschedule_reason : null,
            'event_type_id' => $event?->event_type_id,
            'event_type_name' => $event?->eventType?->name,
            'event_date' => $startDate,
            'event_end_date' => $endDate,
            'days' => $days,
            'is_multi_day' => $isMultiDay,
            'booking_scope' => $event?->booking_scope ?? ($isMultiDay ? 'multi_day' : 'regular'),
            'event_time' => $event?->event_time,
            'venue' => $event?->venue,
            'location' => $event?->venue,
            'guests_count' => (int) ($event?->guests_count ?? 0),
            'service_type' => $event?->service_type,
            'delivery_method' => $event?->delivery_method,
            'menu_selection_type' => $event?->menu_selection_type,
            'special_requests' => $event?->special_requests,
            'total_amount' => $totalAmount,
            'paid_amount' => $paidAmount,
            'balance' => max(0, $totalAmount - $paidAmount),
            'payment_status' => $paidAmount <= 0 ? 'pending' : ($paidAmount < $totalAmount ? 'partial' : 'paid'),
            'assigned_staff' => $assignedStaff,
            'assigned_staff_count' => $assignedStaff->count(),
            'total_staff_required' => $assignedStaff->count(),
            'event_completed' => (bool) ($completionMetadata['event_completed'] ?? false),
            'event_done' => (bool) ($ongoingMetadata['event_done'] ?? false),
            'event_done_at' => $ongoingMetadata['event_done_at'] ?? null,
            'progress' => (int) ($ongoingTracking?->progress_percentage ?? 0),
            'debt_booking_event' => (bool) ($completionMetadata['debt_booking_event'] ?? false),
            'was_debt_booking_event' => (bool) ($completionMetadata['was_debt_booking_event'] ?? $completionMetadata['debt_booking_event'] ?? false),
            'completion_override_reason' => $completionMetadata['override_reason'] ?? null,
            'outstanding_balance' => max(0, $totalAmount - $paidAmount),
            'menu_items' => $bookingItems->map(fn($item) => [
                'id' => $item->booking_item_id,
                'meal_service_id' => $item->meal_service_id ?? null,
                'meal_type' => $item->mealService?->meal_type,
                'service_date' => $item->mealService?->service_date?->toDateString(),
                'name' => $item->custom_item_name ?? $item->menuItem?->name ?? 'Menu item',
                'description' => $item->description,
                'quantity' => (int) $item->quantity,
                'total_quantity' => (int) $item->quantity,
                'price' => (float) $item->unit_price,
                'total_price' => (float) $item->unit_price * (int) $item->quantity,
                'special_instructions' => $item->special_instructions,
            ])->values(),
            'event_days' => $eventDays,
            'meal_services' => $mealServices,
            'meal_schedule' => $mealServices,
            'billing_summary' => [
                'total_meal_amount' => (float) $mealServices->sum('total_meal_amount'),
                'charges' => $chargeRows->where('charge_kind', 'charge')->values()->map(fn($charge) => [
                    'charge_type' => $charge->charge_type,
                    'description' => $charge->description,
                    'amount' => (float) $charge->amount,
                ]),
                'discounts' => $chargeRows->where('charge_kind', 'discount')->values()->map(fn($charge) => [
                    'charge_type' => $charge->charge_type,
                    'description' => $charge->description,
                    'amount' => (float) $charge->amount,
                ]),
                'additional_charges' => (float) $chargeRows->where('charge_kind', 'charge')->sum('amount'),
                'discount' => (float) $chargeRows->where('charge_kind', 'discount')->sum('amount'),
                'grand_total' => $totalAmount,
                'down_payment' => (float) $payments->where('payment_type', 'deposit')->where('status', 'completed')->sum('amount'),
                'remaining_balance' => max(0, $totalAmount - $paidAmount),
                'payment_status' => $paidAmount <= 0 ? 'pending' : ($paidAmount < $totalAmount ? 'partial' : 'paid'),
            ],
            'package_summary' => $event?->package ? [
                'name' => $event->package->name,
                'description' => $event->package->description,
                'base_price_per_pax' => (float) $event->package->base_price_per_pax,
                'total_menu_items' => $bookingItems->count(),
            ] : null,
            'order' => $booking->order,
            'invoice' => $booking->invoice,
            'equipment' => $equipmentRows,
            'tracking' => $trackingRows,
        ];
    }

    private function paginateCollection(Collection $items, Request $request): LengthAwarePaginator
    {
        $page = max(1, $request->integer('page', 1));
        $perPage = max(1, min(100, $request->integer('per_page', 20)));
        $items = $items->values();
        return new LengthAwarePaginator(
            $items->slice(($page - 1) * $perPage, $perPage)->values(),
            $items->count(),
            $perPage,
            $page,
            ['path' => $request->url(), 'query' => $request->query()]
        );
    }

    private function synchronizeBookingInvoice(Booking $booking): void
    {
        $booking->loadMissing('invoice');
        if (! $booking->invoice) {
            return;
        }

        $completed = (float) $booking->payments()
            ->where('status', 'completed')
            ->where('payment_type', '!=', 'refund')
            ->sum('amount');
        $refunded = (float) $booking->payments()
            ->where('status', 'completed')
            ->where('payment_type', 'refund')
            ->sum('amount');
        $netPaid = max(0, $completed - $refunded);
        $total = (float) $booking->invoice->total_amount;
        $status = $netPaid >= $total && $total > 0 ? 'paid' : ($netPaid > 0 ? 'partial' : 'unpaid');
        if ($status !== 'paid' && $booking->invoice->due_date?->isPast()) {
            $status = 'overdue';
        }

        $booking->invoice->update([
            'paid_amount' => $netPaid,
            'status' => $status,
        ]);
    }

    public function availability(Request $request): JsonResponse
    {
        return $this->getAvailability($request);
    }

    private function handleConfirmedBooking(Booking $booking): void
    {
        try {
            $service = app(\App\Services\BookingService::class);

            if (method_exists($service, 'createOrderFromBooking')) {
                $service->createOrderFromBooking($booking);
            }

            if (method_exists($service, 'createKitchenPreparation')) {
                $service->createKitchenPreparation($booking);
            }

            if (method_exists($service, 'createDeliveryPreparation')) {
                $service->createDeliveryPreparation($booking);
            }

            if (method_exists($service, 'createIngredientsManagement')) {
                $service->createIngredientsManagement($booking);
            }
        } catch (\Exception $e) {
            \Log::error('Auto-confirm booking failed: ' . $e->getMessage());
        }
    }
}
