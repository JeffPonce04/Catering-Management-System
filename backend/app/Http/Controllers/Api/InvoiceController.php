<?php

namespace App\Http\Controllers\Api;

use App\Models\Booking;
use App\Models\ChatMessage;
use App\Models\ChatThread;
use App\Models\Invoice;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        try {
            $query = Invoice::with([
                'booking.serviceEvent.customer.person',
                'booking.serviceEvent.eventType',
                'booking.payments'
            ]);

            if (! $request->boolean('include_history')) {
                $query->whereHas('booking', fn($q) => $q->where('booking_no', 'not like', 'HIST-%'));
            }

            // Operational invoice lists show outstanding balances only. Paid
            // invoices remain available through /payments/history and reports.
            if (! $request->boolean('include_paid')) {
                $query->whereColumn('paid_amount', '<', 'total_amount')
                    ->where('status', '!=', 'cancelled');
            }

            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            if ($request->filled('booking_id')) {
                $query->where('booking_id', $request->input('booking_id'));
            }

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('invoice_number', 'like', "%{$search}%")
                        ->orWhereHas('booking.serviceEvent.customer.person', function ($person) use ($search) {
                            $person->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%");
                        });
                });
            }

            $rows = $query->latest('invoice_id')->paginate($request->integer('per_page', 20));

            $rows->getCollection()->transform(function ($invoice) {
                return $this->formatInvoice($invoice);
            });

            return $this->ok($rows);
        } catch (\Exception $e) {
            Log::error('Invoice index error: ' . $e->getMessage());
            return $this->fail('Failed to load invoices: ' . $e->getMessage(), 500);
        }
    }

    public function show(Invoice $invoice)
    {
        try {
            $invoice->load([
                'booking.serviceEvent.customer.person',
                'booking.serviceEvent.eventType',
                'booking.items.menuItem',
                'booking.payments'
            ]);
            return $this->ok($this->formatInvoice($invoice));
        } catch (\Exception $e) {
            Log::error('Invoice show error: ' . $e->getMessage());
            return $this->fail('Failed to load invoice: ' . $e->getMessage(), 500);
        }
    }

    public function store(Request $request)
    {
        try {
            $data = $request->validate([
                'booking_id' => ['required', 'exists:bookings,booking_id'],
                'subtotal' => ['nullable', 'numeric', 'min:0'],
                'discount' => ['nullable', 'numeric', 'min:0'],
                'discount_type' => ['nullable', 'in:fixed,percentage'],
                'additional_charges' => ['nullable', 'numeric', 'min:0'],
                'total_amount' => ['nullable', 'numeric', 'min:0'],
                'due_date' => ['nullable', 'date'],
                'notes' => ['nullable', 'string'],
            ]);

            $booking = Booking::with([
                'serviceEvent.customer.person',
                'serviceEvent.eventType',
                'items.menuItem',
                'quotation'
            ])->findOrFail($data['booking_id']);

            // Check if invoice already exists
            if ($booking->invoice) {
                return $this->fail('Invoice already exists for this booking.', 422);
            }

            $user = $request->user();
            $isCashier = $user?->hasAnyRole(['cashier', 'finance', 'finance-staff', 'finance_staff']) ?? false;
            $isAdministrator = $user?->hasAnyRole(['admin', 'administrator', 'owner', 'super-admin', 'super_admin', 'superadmin']) ?? false;

            if ($isCashier && ! $isAdministrator && ! in_array($booking->booking_status, ['confirmed', 'approved'], true)) {
                return $this->fail('Cashiers may generate invoices only for confirmed bookings.', 403);
            }

            // Cashier-generated invoices use the approved booking/quotation price. Only an
            // administrator may introduce price, discount, or additional-charge adjustments.
            $approvedSubtotal = $booking->quotation?->total_amount ?? $this->calculateSubtotalFromBooking($booking);
            $subtotal = ($isCashier && ! $isAdministrator) ? $approvedSubtotal : ($data['subtotal'] ?? $approvedSubtotal);
            $discount = ($isCashier && ! $isAdministrator) ? 0 : ($data['discount'] ?? 0);
            $discountType = ($isCashier && ! $isAdministrator) ? 'fixed' : ($data['discount_type'] ?? 'fixed');
            $additionalCharges = ($isCashier && ! $isAdministrator) ? 0 : ($data['additional_charges'] ?? 0);

            // Calculate total amount
            $totalAmount = $this->calculateTotalAmount($subtotal, $discount, $discountType, $additionalCharges);

            $invoice = DB::transaction(function () use ($booking, $data, $subtotal, $discount, $discountType, $additionalCharges, $totalAmount) {
                return Invoice::create([
                    'invoice_number' => $this->generateInvoiceNumber(),
                    'booking_id' => $booking->booking_id,
                    'subtotal' => $subtotal,
                    'discount' => $discount,
                    'discount_type' => $discountType,
                    'additional_charges' => $additionalCharges,
                    'total_amount' => $totalAmount,
                    'paid_amount' => 0,
                    'status' => 'unpaid',
                    'due_date' => $data['due_date'] ?? now()->addDays(30)->toDateString(),
                    'notes' => $data['notes'] ?? null,
                ]);
            });

            return $this->ok(
                $this->formatInvoice($invoice->fresh('booking')),
                'Invoice created successfully.'
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Invoice store error: ' . $e->getMessage());
            return $this->fail('Failed to create invoice: ' . $e->getMessage(), 500);
        }
    }

    public function update(Request $request, Invoice $invoice)
    {
        try {
            $user = $request->user();
            $isCashier = $user?->hasAnyRole(['cashier', 'finance', 'finance-staff', 'finance_staff']) ?? false;
            $isAdministrator = $user?->hasAnyRole(['admin', 'administrator', 'owner', 'super-admin', 'super_admin', 'superadmin']) ?? false;

            if ($isCashier && ! $isAdministrator && $request->hasAny([
                'subtotal', 'discount', 'discount_type', 'additional_charges', 'status',
            ])) {
                return $this->fail('Pricing and invoice status adjustments require administrator approval.', 403);
            }

            $data = $request->validate([
                'subtotal' => ['nullable', 'numeric', 'min:0'],
                'discount' => ['nullable', 'numeric', 'min:0'],
                'discount_type' => ['nullable', 'in:fixed,percentage'],
                'additional_charges' => ['nullable', 'numeric', 'min:0'],
                'due_date' => ['nullable', 'date'],
                'status' => ['nullable', 'in:unpaid,partial,paid,overdue,cancelled'],
                'notes' => ['nullable', 'string'],
            ]);

            // Recalculate total amount
            $subtotal = $data['subtotal'] ?? $invoice->subtotal;
            $discount = $data['discount'] ?? $invoice->discount;
            $discountType = $data['discount_type'] ?? $invoice->discount_type ?? 'fixed';
            $additionalCharges = $data['additional_charges'] ?? $invoice->additional_charges;

            $totalAmount = $this->calculateTotalAmount($subtotal, $discount, $discountType, $additionalCharges);

            $invoice->update([
                'subtotal' => $subtotal,
                'discount' => $discount,
                'discount_type' => $discountType,
                'additional_charges' => $additionalCharges,
                'total_amount' => $totalAmount,
                'due_date' => $data['due_date'] ?? $invoice->due_date,
                'status' => $data['status'] ?? $invoice->status,
                'notes' => $data['notes'] ?? $invoice->notes,
            ]);

            return $this->ok(
                $this->formatInvoice($invoice->fresh('booking')),
                'Invoice updated successfully.'
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Invoice update error: ' . $e->getMessage());
            return $this->fail('Failed to update invoice: ' . $e->getMessage(), 500);
        }
    }

    public function destroy(Invoice $invoice)
    {
        try {
            $invoice->delete();
            return $this->ok(null, 'Invoice deleted successfully.');
        } catch (\Exception $e) {
            Log::error('Invoice delete error: ' . $e->getMessage());
            return $this->fail('Failed to delete invoice: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get confirmed bookings that don't have invoices yet
     * FIXED: Only shows bookings WITHOUT invoices
     */
    public function getConfirmedBookings(Request $request)
    {
        try {
            $bookings = Booking::with([
                'serviceEvent.customer.person',
                'serviceEvent.eventType',
                'items.menuItem',
                'quotation'
            ])
                ->whereIn('booking_status', ['confirmed', 'completed'])
                ->where('booking_no', 'not like', 'HIST-%')
                ->whereDoesntHave('invoice')  // CRITICAL: Only bookings without invoices
                ->latest('booking_id')
                ->paginate($request->integer('per_page', 20));

            $bookings->getCollection()->transform(function ($booking) {
                $person = $booking->serviceEvent?->customer?->person;
                $subtotal = $this->calculateSubtotalFromBooking($booking);

                return [
                    'booking_id' => $booking->booking_id,
                    'booking_no' => $booking->booking_no,
                    'customer_name' => $person?->full_name ?? 'Unknown',
                    'customer_email' => $person?->email ?? 'N/A',
                    'customer_phone' => $person?->phone ?? 'N/A',
                    'customer_address' => $person?->address_line_1,
                    'event_type' => $booking->serviceEvent?->eventType?->name,
                    'event_date' => $booking->serviceEvent?->event_date?->toDateString(),
                    'event_time' => $booking->serviceEvent?->event_time,
                    'venue' => $booking->serviceEvent?->venue,
                    'guests_count' => $booking->serviceEvent?->guests_count ?? 0,
                    'subtotal' => $subtotal,
                    'total_amount' => $booking->quotation?->total_amount ?? $subtotal,
                    'required_deposit' => $booking->required_deposit ?? 0,
                    'status' => $booking->booking_status,
                    'items' => $booking->items->map(function ($item) {
                        return [
                            'description' => $item->custom_item_name ?? $item->menuItem?->name ?? 'Menu Item',
                            'quantity' => (int) $item->quantity,
                            'unit_price' => (float) $item->unit_price,
                        ];
                    }),
                ];
            });

            return $this->ok($bookings);
        } catch (\Exception $e) {
            Log::error('Get confirmed bookings error: ' . $e->getMessage());
            return $this->fail('Failed to load confirmed bookings: ' . $e->getMessage(), 500);
        }
    }

    public function debts(Request $request)
    {
        try {
            $query = Invoice::with([
                'booking.serviceEvent.customer.person',
                'booking.serviceEvent.eventType',
                'booking.payments'
            ])
                ->whereRaw('paid_amount < total_amount')
                ->where('status', '!=', 'cancelled')
                ->whereHas('booking', fn($q) => $q->where('booking_no', 'not like', 'HIST-%'));

            if ($request->boolean('overdue_only')) {
                $query->whereDate('due_date', '<', today());
            }

            if ($request->filled('customer_id')) {
                $query->whereHas('booking.serviceEvent', function ($q) use ($request) {
                    $q->where('customer_id', $request->input('customer_id'));
                });
            }

            $rows = $query->latest('due_date')->paginate($request->integer('per_page', 20));

            $rows->getCollection()->transform(function ($invoice) {
                $balance = $invoice->total_amount - $invoice->paid_amount;
                $dueDate = $invoice->due_date;
                $daysOverdue = $dueDate && $dueDate->isPast() ? $dueDate->diffInDays(now()) : 0;

                $paymentHistory = ($invoice->booking?->payments ?? collect())
                    ->where('status', 'completed')
                    ->sortByDesc('payment_date')
                    ->values()
                    ->map(function ($p) {
                        return [
                            'amount' => $p->amount,
                            'signed_amount' => $p->payment_type === 'refund' ? -(float) $p->amount : (float) $p->amount,
                            'date' => $p->payment_date?->toDateString(),
                            'method' => $p->payment_method,
                            'type' => $p->payment_type,
                            'status' => $p->status,
                            'reference' => $p->reference_number,
                        ];
                    });

                return [
                    'id' => $invoice->invoice_id,
                    'invoice_id' => $invoice->invoice_id,
                    'invoice_number' => $invoice->invoice_number ?? 'N/A',
                    'booking_id' => $invoice->booking_id,
                    'booking_no' => $invoice->booking?->booking_no ?? 'N/A',
                    'customer_name' => $invoice->booking?->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                    'customer_email' => $invoice->booking?->serviceEvent?->customer?->person?->email ?? 'N/A',
                    'customer_phone' => $invoice->booking?->serviceEvent?->customer?->person?->phone ?? 'N/A',
                    'event_type' => $invoice->booking?->serviceEvent?->eventType?->name,
                    'event_date' => $invoice->booking?->serviceEvent?->event_date?->toDateString(),
                    'total_debt' => (float) $invoice->total_amount,
                    'paid_debt' => (float) $invoice->paid_amount,
                    'remaining_debt' => (float) $balance,
                    'remaining_balance' => (float) $balance,
                    'total_paid' => (float) $invoice->paid_amount,
                    'payment_progress' => (float) $invoice->total_amount > 0
                        ? round(min(100, ((float) $invoice->paid_amount / (float) $invoice->total_amount) * 100), 2)
                        : 0,
                    'next_payment' => $balance > 0 ? $dueDate?->toDateString() : null,
                    'subtotal' => (float) $invoice->subtotal,
                    'discount' => (float) $invoice->discount,
                    'additional_charges' => (float) $invoice->additional_charges,
                    'due_date' => $dueDate?->toDateString(),
                    'days_overdue' => $daysOverdue,
                    'status' => $invoice->status,
                    'payment_history' => $paymentHistory,
                    'deposit_paid' => $this->calculateDepositPaid($invoice),
                    'is_deposit_paid' => $this->isDepositPaid($invoice),
                    'created_at' => $invoice->created_at?->toDateTimeString(),
                ];
            });

            $base = Invoice::whereRaw('paid_amount < total_amount')
                ->where('status', '!=', 'cancelled')
                ->whereHas('booking', fn($q) => $q->where('booking_no', 'not like', 'HIST-%'));

            $summary = [
                'total_debt' => (float) (clone $base)->sum(DB::raw('total_amount - paid_amount')),
                'overdue_debt' => (float) (clone $base)->whereDate('due_date', '<', today())->sum(DB::raw('total_amount - paid_amount')),
                'overdue_count' => (clone $base)->whereDate('due_date', '<', today())->count(),
                'total_invoices' => (clone $base)->count(),
                'collection_rate' => $this->calculateCollectionRate(),
                'deposit_collection_rate' => $this->calculateDepositCollectionRate(),
            ];

            return $this->ok(['data' => $rows, 'summary' => $summary]);
        } catch (\Exception $e) {
            Log::error('Debts error: ' . $e->getMessage());
            return $this->fail('Failed to load debts: ' . $e->getMessage(), 500);
        }
    }

    public function payments(Invoice $invoice)
    {
        try {
            $payments = $invoice->booking?->payments()->latest('payment_id')->get() ?? collect();
            return $this->ok($payments->map(function ($payment) {
                return [
                    'id' => $payment->payment_id,
                    'payment_number' => $payment->payment_number,
                    'amount' => (float) $payment->amount,
                    'method' => $payment->payment_method,
                    'type' => $payment->payment_type,
                    'status' => $payment->status,
                    'date' => $payment->payment_date?->toDateString(),
                    'reference' => $payment->reference_number,
                    'notes' => $payment->notes,
                ];
            })->values());
        } catch (\Exception $e) {
            Log::error('Invoice payments error: ' . $e->getMessage());
            return $this->fail('Failed to load payments: ' . $e->getMessage(), 500);
        }
    }

    public function sendReminder(Request $request, Invoice $invoice)
    {
        try {
            $data = $request->validate([
                'subject' => ['required', 'string', 'max:200'],
                'message' => ['required', 'string'],
            ]);

            $invoice->loadMissing(['booking.serviceEvent.customer.person']);
            $customer = $invoice->booking?->serviceEvent?->customer;
            $person = $customer?->person;
            $email = $person?->email;

            $gmailStatus = $email ? 'sent' : 'no_email';
            $messengerStatus = 'unavailable';

            if ($email) {
                try {
                    Mail::raw($data['message'], function ($mail) use ($email, $data, $invoice) {
                        $mail->to($email)->subject($data['subject'] ?: "Payment Reminder {$invoice->invoice_number}");
                    });
                } catch (\Throwable $e) {
                    $gmailStatus = 'failed';
                    Log::warning('Invoice Gmail reminder failed: ' . $e->getMessage(), ['invoice_id' => $invoice->invoice_id]);
                }
            }

            if ($customer?->customer_id) {
                try {
                    $thread = ChatThread::query()->firstOrCreate(
                        ['customer_id' => $customer->customer_id, 'status' => 'open'],
                        ['assigned_user_id' => null]
                    );

                    ChatMessage::query()->create([
                        'thread_id' => $thread->thread_id,
                        'sender_user_id' => null,
                        'message' => $data['message'],
                    ]);

                    $messengerStatus = 'sent';
                } catch (\Throwable $e) {
                    $messengerStatus = 'failed';
                    Log::warning('Invoice Messenger reminder failed: ' . $e->getMessage(), ['invoice_id' => $invoice->invoice_id]);
                }
            }

            if (!$customer?->user_id && !$email && $messengerStatus !== 'sent') {
                return $this->fail('Customer contact channel not found.', 422);
            }

            $deliveryStatus = ($gmailStatus === 'sent' || $messengerStatus === 'sent') ? 'Sent' : 'Failed';

            if ($customer?->user_id) {
                Notification::create([
                    'user_id' => $customer->user_id,
                    'type' => 'payment_reminder',
                    'priority' => Notification::PRIORITY_HIGH,
                    'title' => $data['subject'],
                    'message' => $data['message'],
                    'data' => [
                        'invoice_id' => $invoice->invoice_id,
                        'invoice_number' => $invoice->invoice_number,
                        'gmail_delivery_status' => $gmailStatus,
                        'messenger_delivery_status' => $messengerStatus,
                        'delivery_status' => $deliveryStatus,
                    ],
                    'is_read' => false,
                    'is_sent' => true,
                    'sent_at' => now(),
                ]);
            }

            return $this->ok([
                'delivery_status' => $deliveryStatus,
                'gmail_delivery_status' => $gmailStatus,
                'messenger_delivery_status' => $messengerStatus,
            ], 'Reminder sent successfully.');
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Send reminder error: ' . $e->getMessage());
            return $this->fail('Failed to send reminder: ' . $e->getMessage(), 500);
        }
    }

    public function download(Invoice $invoice)
    {
        try {
            $invoice->load(['booking.serviceEvent.customer.person', 'booking.items.menuItem']);
            return $this->ok($this->formatInvoice($invoice), 'Invoice data ready for download.');
        } catch (\Exception $e) {
            Log::error('Invoice download error: ' . $e->getMessage());
            return $this->fail('Failed to download invoice: ' . $e->getMessage(), 500);
        }
    }

    // ==================== PRIVATE HELPER METHODS ====================

    private function formatInvoice($invoice): array
    {
        $invoice->loadMissing([
            'booking.serviceEvent.customer.person',
            'booking.serviceEvent.eventType',
            'booking.items.menuItem'
        ]);

        $booking = $invoice->booking;
        $event = $booking?->serviceEvent;
        $person = $event?->customer?->person;

        return [
            'id' => $invoice->invoice_id,
            'invoice_id' => $invoice->invoice_id,
            'invoice_number' => $invoice->invoice_number ?? 'N/A',
            'booking_id' => $booking?->booking_id,
            'booking_no' => $booking?->booking_no ?? 'N/A',
            'customer_name' => $person?->full_name ?? 'Unknown',
            'customer_email' => $person?->email ?? 'N/A',
            'customer_phone' => $person?->phone ?? 'N/A',
            'customer_address' => $person?->address_line_1,
            'event_type' => $event?->eventType?->name ?? 'General',
            'event_date' => $event?->event_date?->toDateString(),
            'subtotal' => (float) $invoice->subtotal,
            'discount' => (float) $invoice->discount,
            'discount_type' => $invoice->discount_type ?? 'fixed',
            'additional_charges' => (float) $invoice->additional_charges,
            'total_amount' => (float) $invoice->total_amount,
            'paid_amount' => (float) $invoice->paid_amount,
            'balance' => (float) ($invoice->total_amount - $invoice->paid_amount),
            'required_deposit' => round((float) $invoice->total_amount * 0.30, 2),
            'deposit_paid' => $this->calculateDepositPaid($invoice),
            'is_deposit_paid' => $this->isDepositPaid($invoice),
            'status' => $invoice->status,
            'issue_date' => $invoice->created_at?->toDateString(),
            'due_date' => $invoice->due_date?->toDateString(),
            'notes' => $invoice->notes,
            'items' => $booking?->items->map(function ($item) {
                return [
                    'description' => $item->custom_item_name ?? $item->menuItem?->name ?? 'Menu Item',
                    'quantity' => (int) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'total' => (float) $item->unit_price * (int) $item->quantity,
                ];
            })->values() ?? [],
            'payments' => ($booking?->relationLoaded('payments')
                ? $booking->payments
                : ($booking?->payments()->get() ?? collect()))
                ->where('status', 'completed')
                ->values()
                ->map(function ($p) {
                    return [
                        'id' => $p->payment_id,
                        'amount' => $p->amount,
                        'method' => $p->payment_method,
                        'type' => $p->payment_type,
                        'reference' => $p->reference_number,
                        'date' => $p->payment_date?->toDateString(),
                    ];
                }),
        ];
    }

    private function calculateSubtotalFromBooking($booking): float
    {
        $total = 0;
        foreach ($booking->items as $item) {
            $total += ($item->unit_price ?? 0) * ($item->quantity ?? 1);
        }
        return (float) $total;
    }

    private function calculateTotalAmount(float $subtotal, float $discount, string $discountType, float $additionalCharges): float
    {
        $discountAmount = 0;

        if ($discountType === 'percentage') {
            $discountAmount = $subtotal * ($discount / 100);
        } else {
            $discountAmount = $discount;
        }

        return max(0, $subtotal - $discountAmount + $additionalCharges);
    }

    private function calculateDepositPaid($invoice): float
    {
        $depositPayments = $invoice->booking?->payments()
            ->where('payment_type', 'deposit')
            ->where('status', 'completed')
            ->sum('amount');
        return (float) $depositPayments;
    }

    private function isDepositPaid($invoice): bool
    {
        $requiredDeposit = $invoice->booking?->required_deposit ?? ($invoice->total_amount * 0.3 ?? 0);
        $paidDeposit = $this->calculateDepositPaid($invoice);
        return $paidDeposit >= $requiredDeposit;
    }

    private function calculateCollectionRate(): float
    {
        $query = Invoice::where('status', '!=', 'cancelled')
            ->whereHas('booking', fn($q) => $q->where('booking_no', 'not like', 'HIST-%'));
        $total = (float) (clone $query)->sum('total_amount');
        $paid = (float) (clone $query)->sum('paid_amount');
        return $total <= 0 ? 100 : round(($paid / $total) * 100, 2);
    }

    private function calculateDepositCollectionRate(): float
    {
        $bookings = Booking::whereIn('booking_status', ['confirmed', 'completed'])
            ->where('booking_no', 'not like', 'HIST-%')
            ->with(['quotation', 'payments'])
            ->get();
        $totalDeposits = 0;
        $paidDeposits = 0;

        foreach ($bookings as $booking) {
            $required = $booking->required_deposit ?? ($booking->quotation?->total_amount * 0.3 ?? 0);
            $paid = $booking->payments
                ->where('payment_type', 'deposit')
                ->where('status', 'completed')
                ->sum('amount');
            $totalDeposits += $required;
            $paidDeposits += min($paid, $required);
        }

        return $totalDeposits <= 0 ? 100 : round(($paidDeposits / $totalDeposits) * 100, 2);
    }

    private function generateInvoiceNumber(): string
    {
        $count = Invoice::count() + 1;
        return 'INV-' . now()->format('Ymd') . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
    }
}
