<?php

namespace App\Http\Controllers\Api;

use App\Models\Booking;
use App\Models\BookingPayment;
use App\Models\Invoice;
use App\Models\Notification;
use App\Models\AuditLog;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Throwable;
use Illuminate\Validation\ValidationException;

class PaymentController extends Controller
{
    /**
     * Display a listing of all payments with filters
     */
    public function index(Request $request)
    {
        try {
            $query = BookingPayment::with([
                'booking.serviceEvent.customer.person',
                'booking.invoice',
                'verifier.person'
            ]);

            if (! $request->boolean('include_history')) {
                $query->whereHas(
                    'booking',
                    fn($bookingQuery) =>
                    $bookingQuery->where('booking_no', 'not like', 'HIST-%')
                );
            }

            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            if ($request->filled('booking_id')) {
                $query->where('booking_id', $request->input('booking_id'));
            }

            if ($request->filled('payment_method')) {
                $query->where('payment_method', $request->input('payment_method'));
            }

            if ($request->filled('payment_type')) {
                $query->where('payment_type', $request->input('payment_type'));
            }

            if ($request->filled('date_from')) {
                $query->where('payment_date', '>=', $request->date('date_from'));
            }
            if ($request->filled('date_to')) {
                $query->where('payment_date', '<=', $request->date('date_to'));
            }

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('reference_number', 'like', "%{$search}%")
                        ->orWhere('payment_number', 'like', "%{$search}%")
                        ->orWhere('account_name', 'like', "%{$search}%")
                        ->orWhereHas('booking.serviceEvent.customer.person', function ($person) use ($search) {
                            $person->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%");
                        });
                });
            }

            $summaryQuery = clone $query;
            $payments = $query->latest('payment_id')->paginate($request->integer('per_page', 20));

            $payments->getCollection()->transform(function ($payment) {
                return $this->formatPaymentWithFullDetails($payment);
            });

            return $this->ok([
                'data' => $payments,
                'summary' => [
                    'gross_completed_amount' => (float) (clone $summaryQuery)->whereIn('status', ['completed', 'refunded'])->where('payment_type', '!=', 'refund')->sum('amount'),
                    'refunded_amount' => (float) (clone $summaryQuery)->where('status', 'completed')->where('payment_type', 'refund')->sum('amount'),
                    'net_completed_amount' => $this->netCompletedAmount(clone $summaryQuery),
                    'pending_amount' => (float) (clone $summaryQuery)->where('status', 'pending')->sum('amount'),
                    'failed_amount' => (float) (clone $summaryQuery)->where('status', 'failed')->sum('amount'),
                    'total_count' => (clone $summaryQuery)->count(),
                    'completed_count' => (clone $summaryQuery)->where('status', 'completed')->count(),
                    'pending_count' => (clone $summaryQuery)->where('status', 'pending')->count(),
                    'by_method' => (clone $summaryQuery)->select('payment_method')
                        ->selectRaw('COUNT(*) as count, SUM(amount) as total')
                        ->where('status', 'completed')
                        ->groupBy('payment_method')
                        ->get(),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Payment index error: ' . $e->getMessage());
            return $this->fail('Failed to load payments: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Payment Tracking contains every payment log, regardless of verification or
     * whether the related invoice has already been settled.
     */
    public function tracking(Request $request)
    {
        return $this->index($request);
    }

    /**
     * Payment History contains one row per fully-paid invoice only.
     */
    public function history(Request $request)
    {
        try {
            $query = Invoice::with([
                'booking.serviceEvent.customer.person',
                'booking.payments' => fn($payments) => $payments->latest('payment_date'),
            ])
                ->whereHas('booking', function ($bookingQuery) use ($request) {
                    if (! $request->boolean('include_history')) {
                        $bookingQuery->where('booking_no', 'not like', 'HIST-%');
                    }
                })
                ->where('status', 'paid')
                ->where('total_amount', '>', 0)
                ->whereColumn('paid_amount', '>=', 'total_amount');

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($invoice) use ($search) {
                    $invoice->where('invoice_number', 'like', "%{$search}%")
                        ->orWhereHas('booking.serviceEvent.customer.person', function ($person) use ($search) {
                            $person->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%");
                        });
                });
            }

            $invoices = $query->latest('invoice_id')->paginate($request->integer('per_page', 20));
            $invoices->getCollection()->transform(function (Invoice $invoice) {
                $completedPayments = $invoice->booking?->payments
                    ?->where('status', 'completed')
                    ->where('payment_type', '!=', 'refund')
                    ->values() ?? collect();
                $latestPayment = $completedPayments->sortByDesc('payment_date')->first();
                $methods = $completedPayments->pluck('payment_method')->filter()->unique()->values();
                $person = $invoice->booking?->serviceEvent?->customer?->person;

                return [
                    'id' => 'invoice-' . $invoice->invoice_id,
                    'payment_id' => $latestPayment?->payment_id,
                    'invoice_id' => $invoice->invoice_id,
                    'invoice_number' => $invoice->invoice_number,
                    'booking_id' => $invoice->booking_id,
                    'booking_no' => $invoice->booking?->booking_no ?? 'N/A',
                    'customer_name' => $person?->full_name ?? 'Unknown',
                    'customer_email' => $person?->email,
                    'amount' => (float) $invoice->total_amount,
                    'total_amount' => (float) $invoice->total_amount,
                    'paid_amount' => (float) $invoice->paid_amount,
                    'balance' => 0.0,
                    'status' => 'paid',
                    'payment_number' => $latestPayment?->payment_number ?? 'Fully Paid',
                    'payment_method' => $methods->count() > 1 ? 'multiple' : ($methods->first() ?? 'N/A'),
                    'payment_type' => 'full',
                    'reference_number' => $latestPayment?->reference_number ?? 'N/A',
                    'date' => $latestPayment?->payment_date?->toDateString() ?? $invoice->updated_at?->toDateString(),
                    'date_time' => $latestPayment?->payment_date?->toDateTimeString() ?? $invoice->updated_at?->toDateTimeString(),
                    'payment_logs_count' => $completedPayments->count(),
                    'payment_logs' => $completedPayments->map(fn($payment) => [
                        'payment_id' => $payment->payment_id,
                        'payment_number' => $payment->payment_number,
                        'amount' => (float) $payment->amount,
                        'payment_method' => $payment->payment_method,
                        'payment_type' => $payment->payment_type,
                        'reference_number' => $payment->reference_number,
                        'date' => $payment->payment_date?->toDateTimeString(),
                    ])->values(),
                ];
            });

            return $this->ok($invoices);
        } catch (\Throwable $e) {
            Log::error('Payment history error: ' . $e->getMessage());
            return $this->fail('Failed to load payment history: ' . $e->getMessage(), 500);
        }
    }

    public function show(BookingPayment $payment)
    {
        try {
            return $this->ok(
                $this->formatPaymentWithFullDetails(
                    $payment->load(['booking.serviceEvent.customer.person', 'verifier.person', 'booking.invoice'])
                )
            );
        } catch (\Exception $e) {
            Log::error('Payment show error: ' . $e->getMessage());
            return $this->fail('Failed to load payment: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Generate sequential payment number in 4-digit format (PAY-0001).
     *
     * ⭐ Used by every payment entry point: Invoice Payment,
     *    Order & Events Payment, and Mobile Payment.
     */
    private function generatePaymentNumber(): string
    {
        return $this->generateSequentialNumber('PAY-', BookingPayment::class, 'payment_number', 4);
    }

    /**
     * Generic sequential number generator.
     *
     * ⭐ Format: PREFIX-0001, PREFIX-0002, … PREFIX-9999 (then expands).
     *    The counter resets whenever the prefix changes, so PAY- and
     *    REF- keep independent sequences.
     */
    private function generateSequentialNumber(string $prefix, string $modelClass, string $column, int $padding = 4): string
    {
        try {
            if (!class_exists($modelClass)) {
                throw new \Exception("Model class {$modelClass} not found");
            }

            $instance = new $modelClass();
            $keyName = $instance->getKeyName();

            // ⭐ Include soft-deleted rows so a deleted payment number is
            //    never reused.
            $lastRecord = $modelClass::withTrashed()
                ->where($column, 'LIKE', $prefix . '%')
                ->orderBy($keyName, 'desc')
                ->first();

            $nextNumber = 1;

            if ($lastRecord && isset($lastRecord->$column)) {
                // Extract the numeric portion after the prefix.
                $numericPart = preg_replace('/[^0-9]/', '', substr($lastRecord->$column, strlen($prefix)));
                if ($numericPart !== '') {
                    $nextNumber = ((int) $numericPart) + 1;
                }
            }

            return $prefix . str_pad((string) $nextNumber, $padding, '0', STR_PAD_LEFT);
        } catch (\Exception $e) {
            Log::warning("Failed to generate sequential number for {$prefix}: " . $e->getMessage());
            // ⭐ Fallback also honours the 4-digit format.
            return $prefix . str_pad((string) random_int(1, 9999), $padding, '0', STR_PAD_LEFT);
        }
    }
    /**
     * Store a new payment
     */
    public function store(Request $request)
    {
        try {
            $data = $request->validate([
                'booking_id' => ['required', 'exists:bookings,booking_id'],
                'amount' => ['required', 'numeric', 'min:0.01'],
                'payment_method' => ['required', 'in:cash,gcash,maya,bank_transfer,card,check'],
                'payment_type' => ['nullable', 'in:deposit,partial,full'],
                'reference_number' => ['nullable', 'string', 'max:100'],
                'account_name' => ['nullable', 'string', 'max:100'],
                'account_number' => ['nullable', 'string', 'max:50'],
                'transaction_id' => ['nullable', 'string', 'max:100'],
                'notes' => ['nullable', 'string'],
                'receipt_file' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:2048'],
                'verify_immediately' => ['nullable', 'boolean'],
                'force_duplicate' => ['nullable', 'boolean'],
                // ⭐ Overpayment / change fields
                'tendered_amount' => ['nullable', 'numeric', 'min:0'],
                'change_amount' => ['nullable', 'numeric', 'min:0'],
                // ⭐ Payer fields — who physically paid
                'payer_name' => ['nullable', 'string', 'max:150'],
                'payer_relation' => ['nullable', 'string', 'max:100'],
            ]);
            $booking = Booking::with(['invoice', 'quotation', 'items', 'mealServices'])->findOrFail($data['booking_id']);

            // ⭐ Auto-create the invoice the first time a payment is attempted.
            $invoice = $booking->invoice;
            if (! $invoice) {
                $subtotal = (float) ($booking->quotation?->total_amount ?? 0);
                if ($subtotal <= 0) {
                    $itemsTotal = (float) $booking->items->sum(
                        fn($item) => ((float) ($item->unit_price ?? 0)) * ((int) ($item->quantity ?? 1))
                    );
                    $mealsTotal = (float) $booking->mealServices->sum(
                        fn($meal) => ((int) ($meal->pax ?? 0)) * ((float) ($meal->price_per_head ?? 0))
                    );
                    $subtotal = $itemsTotal > 0 ? $itemsTotal : $mealsTotal;
                }

                // ⭐ Delegate to the model helper so the invoice-number
                //    format lives in exactly one place and does not depend
                //    on the SoftDeletes trait being present.
                $invoiceNumber = Invoice::nextInvoiceNumber();
                // ⭐ Pull additional charges + discount from booking_charges
                //    so the invoice total matches what the operator entered
                //    in the Create Booking → Additional Charges step.
                //    (Executed exactly once — the old duplicate block caused
                //     wasted queries and drift.)
                $additionalCharges = 0.0;
                $discount = 0.0;
                if (Schema::hasTable('booking_charges')) {
                    $additionalCharges = (float) DB::table('booking_charges')
                        ->where('booking_id', $booking->booking_id)
                        ->where('charge_kind', 'charge')
                        ->sum('amount');

                    $discount = (float) DB::table('booking_charges')
                        ->where('booking_id', $booking->booking_id)
                        ->where('charge_kind', 'discount')
                        ->sum('amount');
                }

                $totalAmount = max(0, $subtotal + $additionalCharges - $discount);

                $invoice = Invoice::create([
                    'invoice_number'     => $invoiceNumber,
                    'booking_id'         => $booking->booking_id,
                    'subtotal'           => round($subtotal, 2),
                    'discount'           => round($discount, 2),
                    'discount_type'      => 'fixed',
                    'additional_charges' => round($additionalCharges, 2),
                    'total_amount'       => round($totalAmount, 2),
                    'paid_amount'        => 0,
                    'status'             => 'unpaid',
                    'due_date'           => now()->addDays(30)->toDateString(),
                    'notes'              => 'Auto-created on first payment.',
                ]);
                $booking->setRelation('invoice', $invoice);
            }
            $balance = max(0, (float) $invoice->total_amount - (float) $invoice->paid_amount);
            $requiredDeposit = round((float) $invoice->total_amount * 0.30, 2);
            $isFirstPayment = ! BookingPayment::where('booking_id', $booking->booking_id)
                ->where('status', 'completed')
                ->where('payment_type', '!=', 'refund')
                ->exists();

            // ⭐ Block additional mobile payments when the invoice is settled.
            if ($balance <= 0.01 && (float) $invoice->total_amount > 0) {
                return $this->fail(
                    'This booking is already fully paid. Additional payment is not allowed.',
                    422,
                    ['code' => 'fully_paid']
                );
            }
            // ⭐ Overpayment handling — accept any amount, but only record the
            //    amount needed to settle the invoice. The excess is change.
            //
            //    IMPORTANT: `$tenderedAmount` is what the customer handed over.
            //    `$recordedAmount` is what we store on the payment row and is
            //    clamped to the outstanding balance. `$changeAmount` is the
            //    difference — it must be computed ONCE from the tendered amount
            //    and never overwritten from the already-clamped `$recordedAmount`
            //    (doing so always yields 0 and breaks the receipt).
            $tenderedAmount = (float) ($data['tendered_amount'] ?? $data['amount']);
            $recordedAmount = (float) $data['amount'];

            // Clamp the recorded amount so it can never exceed the balance.
            if ($recordedAmount > $balance + 0.01) {
                $recordedAmount = $balance;
            }

            // Compute the change from the ORIGINAL tendered amount.
            $changeAmount = max(0, $tenderedAmount - $recordedAmount);

            // If the frontend explicitly sent a change_amount, trust it when
            // it is larger (matches what the cashier handed back to the customer).
            if (isset($data['change_amount']) && (float) $data['change_amount'] > $changeAmount) {
                $changeAmount = (float) $data['change_amount'];
            }

            // Overwrite $data['amount'] so downstream code uses the corrected value.
            $data['amount'] = $recordedAmount;

            // ⭐ Deposit detection — more lenient so a 30% payment is
            //    always classified as a deposit, even if the amount is
            //    off by a few pesos due to rounding or manual entry.
            if ((float) $data['amount'] >= $balance) {
                $data['payment_type'] = 'full';
            } elseif (
                $isFirstPayment &&
                $requiredDeposit > 0 &&
                (float) $data['amount'] >= ($requiredDeposit - 1.00)
            ) {
                $data['payment_type'] = 'deposit';
            } else {
                $data['payment_type'] = 'partial';
            }

            $recentPayment = BookingPayment::where('booking_id', $booking->booking_id)
                ->where('status', 'completed')
                ->where('payment_type', '!=', 'refund')
                ->where('payment_date', '>=', now()->subMinutes(5))
                ->latest('payment_date')
                ->first();

            if ($recentPayment && ! $request->boolean('force_duplicate')) {
                return $this->fail(
                    'A recent payment already exists for this invoice.',
                    409,
                    [
                        'code' => 'recent_payment',
                        'payment' => [
                            'payment_id' => $recentPayment->payment_id,
                            'payment_number' => $recentPayment->payment_number,
                            'amount' => (float) $recentPayment->amount,
                            'payment_date' => $recentPayment->payment_date?->toDateTimeString(),
                        ],
                    ]
                );
            }

            // ⚠️ DO NOT recompute $changeAmount here. It has already been
            //    calculated from the tendered amount above; recomputing it
            //    from the clamped $data['amount'] always yields 0 and wipes
            //    the real change value out of the notes / receipt.
            if ($changeAmount > 0) {
                $data['notes'] = trim(($data['notes'] ?? '') . "\nChange due: ₱" . number_format($changeAmount, 2));
            }

            $receiptPath = $request->hasFile('receipt_file')
                ? $request->file('receipt_file')->store('receipts', 'public')
                : null;

            $verifyImmediately = $request->boolean('verify_immediately');

            $payment = DB::transaction(function () use ($booking, $data, $receiptPath, $verifyImmediately, $tenderedAmount, $changeAmount) {
                // ⭐ Record the tendered/change amounts inside the notes so the
                //    receipt and audit trail show the full picture without
                //    needing a schema change.
                $baseNotes = $data['notes'] ?? '';
                if ($changeAmount > 0) {
                    $changeLine = 'Change given: ₱' . number_format($changeAmount, 2)
                        . ' (tendered ₱' . number_format($tenderedAmount, 2) . ')';
                    $baseNotes = $baseNotes
                        ? $baseNotes . "\n" . $changeLine
                        : $changeLine;
                }

                $paymentData = [
                    'payment_number' => $this->generatePaymentNumber(),
                    'booking_id' => $booking->booking_id,
                    'amount' => (float) $data['amount'],   // ← already clamped to balance
                    'payment_method' => $data['payment_method'],
                    'payment_type' => $data['payment_type'] ?? 'partial',
                    'reference_number' => $data['reference_number'] ?? $this->generateReferenceNumber(),
                    'transaction_id' => $data['transaction_id'] ?? null,
                    'receipt_file' => $receiptPath,
                    'notes' => $baseNotes ?: null,
                    'status' => $verifyImmediately ? 'completed' : 'pending',
                    'payment_date' => now(),
                    'verified_by' => $verifyImmediately ? auth()->id() : null,
                    'verified_at' => $verifyImmediately ? now() : null,
                ];

                // ⭐ PAYER — who physically handed over the money. Only
                //    stored when different from the customer so legacy
                //    display logic continues to work unchanged.
                if (! empty($data['payer_name'])) {
                    $paymentData['payer_name'] = trim((string) $data['payer_name']);
                }
                if (! empty($data['payer_relation'])) {
                    $paymentData['payer_relation'] = trim((string) $data['payer_relation']);
                }
                // ⭐ Use array_key_exists() instead of isset() — this makes
                //    it possible to CLEAR account_name / account_number by
                //    sending an empty string (isset() returns false for null,
                //    which silently skipped the write and made updates
                //    impossible to observe).
                if (array_key_exists('account_name', $data)) {
                    $paymentData['account_name'] = $data['account_name'];
                }
                if (array_key_exists('account_number', $data)) {
                    $paymentData['account_number'] = $data['account_number'];
                }

                return BookingPayment::create($paymentData);
            });

            // ⭐ CRITICAL FIX: Sync the invoice AFTER the transaction commits.
            //    If syncInvoicePayment throws inside the transaction, the
            //    payment row is rolled back — which is exactly what was
            //    happening before (payments vanishing from the DB).
            try {
                $this->syncInvoicePayment($booking);
            } catch (\Throwable $e) {
                Log::error('syncInvoicePayment failed after commit', [
                    'payment_id' => $payment->payment_id,
                    'booking_id' => $booking->booking_id,
                    'error'      => $e->getMessage(),
                    'trace'      => $e->getTraceAsString(),
                ]);
                // Do not rethrow — the payment is already saved. The invoice
                // will be re-synced on the next payment or manual refresh.
            }

            // ⭐ Notifications are non-critical — never let them roll back the payment.
            if ($verifyImmediately) {
                try {
                    $this->createPaymentNotification($payment);
                } catch (\Throwable $e) {
                    Log::warning('Payment notification failed (payment already saved)', [
                        'payment_id' => $payment->payment_id,
                        'error'      => $e->getMessage(),
                    ]);
                }
            }
            // ⭐ Reload the invoice + booking so the response reflects the new balance.
            $booking->unsetRelation('invoice');
            $booking->load(['invoice', 'payments']);
            $payment->refresh();
            $payment->load(['booking.invoice', 'booking.serviceEvent.customer.person', 'verifier.person']);

            $formattedPayment = $this->formatPaymentWithFullDetails($payment);

            // ⭐ Enriched payload — mirrors the BookingController::recordPayment
            //    shape so the frontend can patch BOTH modules' caches
            //    (Orders & Events + Billing & Invoicing) with one response.
            $invoiceTotal = (float) ($booking->invoice?->total_amount ?? 0);
            $invoicePaid  = (float) ($booking->invoice?->paid_amount ?? 0);

            return $this->ok(
                [
                    'payment' => $formattedPayment,
                    'invoice' => $booking->invoice,
                    'booking' => [
                        'booking_id'   => $booking->booking_id,
                        'booking_no'   => $booking->booking_no,
                        'total_amount' => $invoiceTotal,
                        'paid_amount'  => $invoicePaid,
                        'balance'      => max(0, $invoiceTotal - $invoicePaid),
                        'payments'     => $booking->payments->values(),
                        'invoice'      => $booking->invoice,
                    ],
                ],
                $verifyImmediately ? 'Payment recorded and verified successfully.' : 'Payment recorded successfully.'
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Payment store error: ' . $e->getMessage());
            Log::error($e->getTraceAsString());
            return $this->fail('Failed to record payment: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Generate reference number
     */
    private function generateReferenceNumber(): string
    {
        return 'REF-' . now()->format('YmdHis') . '-' . strtoupper(substr(uniqid(), -5));
    }

    public function update(Request $request, BookingPayment $payment)
    {
        try {
            $data = $request->validate([
                'amount' => ['nullable', 'numeric', 'min:0.01'],
                'payment_method' => ['nullable', 'in:cash,gcash,maya,bank_transfer,card,check'],
                'payment_type' => ['nullable', 'in:deposit,partial,full,refund'],
                'reference_number' => ['nullable', 'string', 'max:100'],
                'account_name' => ['nullable', 'string', 'max:100'],
                'account_number' => ['nullable', 'string', 'max:50'],
                'notes' => ['nullable', 'string'],
                'status' => ['nullable', 'in:pending,completed,failed,refunded'],
            ]);

            $payment->update($data);
            $this->syncInvoicePayment($payment->booking);

            return $this->ok(
                $this->formatPaymentWithFullDetails($payment->fresh()),
                'Payment updated successfully.'
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Payment update error: ' . $e->getMessage());
            return $this->fail('Failed to update payment: ' . $e->getMessage(), 500);
        }
    }

    public function destroy(BookingPayment $payment)
    {
        try {
            $booking = $payment->booking;

            if ($payment->receipt_file && Storage::disk('public')->exists($payment->receipt_file)) {
                Storage::disk('public')->delete($payment->receipt_file);
            }

            $payment->delete();

            if ($booking) {
                $this->syncInvoicePayment($booking);
            }

            return $this->ok(null, 'Payment deleted successfully.');
        } catch (\Exception $e) {
            Log::error('Payment delete error: ' . $e->getMessage());
            return $this->fail('Failed to delete payment: ' . $e->getMessage(), 500);
        }
    }

    public function verify(Request $request, BookingPayment $payment)
    {
        try {
            $data = $request->validate([
                'notes' => ['nullable', 'string'],
                'amount_verified' => ['nullable', 'numeric', 'min:0'],
            ]);

            if ($payment->status === 'completed') {
                return $this->fail('Payment already verified.', 422);
            }

            if ($payment->payment_type === 'refund') {
                return $this->fail('Refund records are completed through the refund endpoint.', 422);
            }

            $amountToVerify = $data['amount_verified'] ?? $payment->amount;

            $payment->update([
                'status' => 'completed',
                'verified_by' => auth()->id(),
                'verified_at' => now(),
                'notes' => $data['notes'] ?? $payment->notes,
                'amount' => $amountToVerify,
            ]);

            $this->syncInvoicePayment($payment->booking);
            $this->createPaymentNotification($payment);

            return $this->ok(
                $this->formatPaymentWithFullDetails($payment->fresh()),
                'Payment verified successfully.'
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Payment verify error: ' . $e->getMessage());
            return $this->fail('Failed to verify payment: ' . $e->getMessage(), 500);
        }
    }

    public function reject(Request $request, BookingPayment $payment)
    {
        try {
            $data = $request->validate([
                'reason' => ['required', 'string'],
            ]);

            $payment->update([
                'status' => 'failed',
                'notes' => $data['reason'],
            ]);

            $this->syncInvoicePayment($payment->booking);

            return $this->ok(
                $this->formatPaymentWithFullDetails($payment->fresh()),
                'Payment rejected.'
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Payment reject error: ' . $e->getMessage());
            return $this->fail('Failed to reject payment: ' . $e->getMessage(), 500);
        }
    }

    public function refund(Request $request, BookingPayment $payment)
    {
        try {
            $data = $request->validate([
                'reason' => ['required', 'string'],
                'refund_amount' => ['nullable', 'numeric', 'min:0.01'],
            ]);

            if ($payment->payment_type === 'refund' || $payment->status !== 'completed') {
                return $this->fail('Only a completed customer payment can be refunded.', 422);
            }

            return DB::transaction(function () use ($payment, $data) {
                $reference = 'refund_of_' . $payment->payment_id;
                $alreadyRefunded = (float) BookingPayment::where('transaction_id', $reference)
                    ->where('payment_type', 'refund')
                    ->where('status', 'completed')
                    ->sum('amount');

                $remaining = max(0, (float) $payment->amount - $alreadyRefunded);
                $refundAmount = (float) ($data['refund_amount'] ?? $remaining);

                if ($refundAmount <= 0 || $refundAmount > $remaining) {
                    return $this->fail('Maximum refundable amount is ₱' . number_format($remaining, 2), 422);
                }

                $refund = BookingPayment::create([
                    'payment_number' => $this->generatePaymentNumber(),
                    'booking_id' => $payment->booking_id,
                    'amount' => $refundAmount,
                    'payment_method' => $payment->payment_method,
                    'payment_type' => 'refund',
                    'reference_number' => $payment->reference_number,
                    'transaction_id' => $reference,
                    'status' => 'completed',
                    'notes' => $data['reason'],
                    'payment_date' => now(),
                    'verified_by' => auth()->id(),
                    'verified_at' => now(),
                ]);

                if ($alreadyRefunded + $refundAmount >= (float) $payment->amount) {
                    $payment->update(['status' => 'refunded']);
                } else {
                    $payment->update([
                        'notes' => trim(($payment->notes ? $payment->notes . "\n" : '') .
                            'Partially refunded: ₱' . number_format($alreadyRefunded + $refundAmount, 2))
                    ]);
                }

                $this->syncInvoicePayment($payment->booking);

                return $this->ok(
                    $this->formatPaymentWithFullDetails($refund->fresh()),
                    'Refund recorded successfully.'
                );
            });
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Payment refund error: ' . $e->getMessage());
            return $this->fail('Failed to process refund: ' . $e->getMessage(), 500);
        }
    }

    public function downloadReceipt(BookingPayment $payment)
    {
        try {
            $html = $this->generateReceiptHTML($payment);
            $filename = "receipt-{$payment->payment_number}.html";

            return response($html, 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ]);
        } catch (\Exception $e) {
            Log::error('Download receipt error: ' . $e->getMessage());
            return $this->fail('Failed to download receipt: ' . $e->getMessage(), 500);
        }
    }

    public function getReceipt(BookingPayment $payment)
    {
        try {
            $payment->load([
                'booking.serviceEvent.customer.person',
                'booking.serviceEvent.eventType',
                'booking.invoice',
                'booking.quotation',
                'booking.items.menuItem',
                'booking.items.mealService',
                'booking.mealServices.menuItem',
                'booking.mealServices.eventDay',
                'booking.mealServices.customItems.menuItem',
                'booking.payments',
            ]);

            return $this->ok([
                'payment' => $this->formatPaymentWithFullDetails($payment),
                'receipt_html' => $this->generateReceiptHTML($payment),
            ]);
        } catch (\Exception $e) {
            Log::error('Get receipt error: ' . $e->getMessage());
            return $this->fail('Failed to load receipt: ' . $e->getMessage(), 500);
        }
    }

    public function getAllMobilePayments(Request $request)
    {
        try {
            $query = BookingPayment::with([
                'booking.serviceEvent.customer.person',
                'booking.invoice',
                'verifier.person'
            ])->whereIn('payment_method', ['gcash', 'maya', 'bank_transfer', 'card']);

            if (! $request->boolean('include_history')) {
                $query->whereHas(
                    'booking',
                    fn($bookingQuery) =>
                    $bookingQuery->where('booking_no', 'not like', 'HIST-%')
                );
            }

            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }

            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('reference_number', 'like', "%{$search}%")
                        ->orWhere('account_name', 'like', "%{$search}%")
                        ->orWhereHas('booking.serviceEvent.customer.person', function ($person) use ($search) {
                            $person->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%");
                        });
                });
            }

            $payments = $query->latest('payment_id')->paginate($request->integer('per_page', 20));

            $payments->getCollection()->transform(function ($payment) {
                return $this->formatPaymentWithFullDetails($payment);
            });

            return $this->ok($payments);
        } catch (\Exception $e) {
            Log::error('Mobile payments error: ' . $e->getMessage());
            return $this->fail('Failed to load mobile payments: ' . $e->getMessage(), 500);
        }
    }

    public function recordMobilePayment(Request $request)
    {
        try {
            $data = $request->validate([
                'booking_id' => ['required', 'exists:bookings,booking_id'],
                'amount' => ['required', 'numeric', 'min:0.01'],
                'payment_method' => ['required', 'in:cash,gcash,maya,bank_transfer,card,check'],
                'payment_type' => ['nullable', 'in:deposit,partial,full'],
                'reference_number' => ['nullable', 'string', 'max:100'],
                'account_name' => ['nullable', 'string', 'max:100'],
                'account_number' => ['nullable', 'string', 'max:50'],
                'notes' => ['nullable', 'string'],
                'proof_of_payment' => ['nullable', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:2048'],
                // ⭐ Payer fields
                'payer_name' => ['nullable', 'string', 'max:150'],
                'payer_relation' => ['nullable', 'string', 'max:100'],
            ]);

            $booking = Booking::with(['invoice', 'quotation', 'items', 'mealServices'])->findOrFail($data['booking_id']);

            // ⭐ Auto-create the invoice the first time a payment is attempted.
            $invoice = $booking->invoice;
            if (! $invoice) {
                $subtotal = (float) ($booking->quotation?->total_amount ?? 0);
                if ($subtotal <= 0) {
                    $itemsTotal = (float) $booking->items->sum(
                        fn($item) => ((float) ($item->unit_price ?? 0)) * ((int) ($item->quantity ?? 1))
                    );
                    $mealsTotal = (float) $booking->mealServices->sum(
                        fn($meal) => ((int) ($meal->pax ?? 0)) * ((float) ($meal->price_per_head ?? 0))
                    );
                    $subtotal = $itemsTotal > 0 ? $itemsTotal : $mealsTotal;
                }

                // ⭐ Pull additional charges + discount from the booking.
                $additionalCharges = 0.0;
                if (Schema::hasTable('booking_charges')) {
                    $additionalCharges = (float) DB::table('booking_charges')
                        ->where('booking_id', $booking->booking_id)
                        ->where('charge_kind', 'charge')
                        ->sum('amount');
                }

                $discount = 0.0;
                if (Schema::hasTable('booking_charges')) {
                    $discount = (float) DB::table('booking_charges')
                        ->where('booking_id', $booking->booking_id)
                        ->where('charge_kind', 'discount')
                        ->sum('amount');
                }

                $totalAmount = max(0, $subtotal + $additionalCharges - $discount);

                $invoice = Invoice::create([
                    'invoice_number'     => Invoice::nextInvoiceNumber(),
                    'booking_id'         => $booking->booking_id,
                    'subtotal'           => round($subtotal, 2),
                    'discount'           => round($discount, 2),
                    'discount_type'      => 'fixed',
                    'additional_charges' => round($additionalCharges, 2),
                    'total_amount'       => round($totalAmount, 2),
                    'paid_amount'        => 0,
                    'status'             => 'unpaid',
                    'due_date'           => now()->addDays(30)->toDateString(),
                    'notes'              => 'Auto-created on first payment.',
                ]);
                $booking->setRelation('invoice', $invoice);
            }
            $balance = max(0, (float) $invoice->total_amount - (float) $invoice->paid_amount);
            $requiredDeposit = round((float) $invoice->total_amount * 0.30, 2);
            $isFirstPayment = ! BookingPayment::where('booking_id', $booking->booking_id)
                ->where('status', 'completed')
                ->where('payment_type', '!=', 'refund')
                ->exists();

            // ⭐ Reject overpayment on the mobile path too.
            if ((float) $data['amount'] > $balance + 0.01) {
                return $this->fail(
                    'Payment amount cannot exceed the remaining balance.',
                    422,
                    [
                        'code' => 'overpayment',
                        'remaining_balance' => $balance,
                        'submitted_amount'  => (float) $data['amount'],
                    ]
                );
            }

            // ⭐ Deposit detection — more lenient so a 30% payment is
            //    always classified as a deposit.
            if ((float) $data['amount'] >= $balance) {
                $data['payment_type'] = 'full';
            } elseif (
                $isFirstPayment &&
                $requiredDeposit > 0 &&
                (float) $data['amount'] >= ($requiredDeposit - 1.00)
            ) {
                $data['payment_type'] = 'deposit';
            } else {
                $data['payment_type'] = 'partial';
            }

            // ⚠️ For mobile payments the customer transfers exactly the
            //    amount they entered — no overpayment / change is possible.
            //    The previous `max(0, $amount - $balance)` always yielded 0
            //    once the amount was clamped, so this whole branch was dead
            //    code. Keep it but guard against the amount actually being
            //    higher than balance (should be rejected above, but be safe).
            $changeAmount = max(0, (float) $data['amount'] - $balance);
            if ($changeAmount > 0) {
                $data['notes'] = trim(($data['notes'] ?? '') . "\nChange due: ₱" . number_format($changeAmount, 2));
            }

            $receiptPath = $request->hasFile('proof_of_payment')
                ? $request->file('proof_of_payment')->store('mobile-payments', 'public')
                : null;
            $payment = DB::transaction(function () use ($booking, $data, $receiptPath) {
                $paymentData = [
                    'payment_number' => $this->generatePaymentNumber(),
                    'booking_id' => $booking->booking_id,
                    'amount' => (float) $data['amount'],
                    'payment_method' => $data['payment_method'],
                    'payment_type' => $data['payment_type'] ?? 'partial',
                    'reference_number' => $data['reference_number'] ?? $this->generateReferenceNumber(),
                    'receipt_file' => $receiptPath,
                    'notes' => $data['notes'] ?? null,
                    'status' => 'pending',
                    'payment_date' => now(),
                ];

                // ⭐ Payer fields
                if (! empty($data['payer_name'])) {
                    $paymentData['payer_name'] = trim((string) $data['payer_name']);
                }
                if (! empty($data['payer_relation'])) {
                    $paymentData['payer_relation'] = trim((string) $data['payer_relation']);
                }
                if (array_key_exists('account_name', $data)) {
                    $paymentData['account_name'] = $data['account_name'];
                }
                if (array_key_exists('account_number', $data)) {
                    $paymentData['account_number'] = $data['account_number'];
                }

                return BookingPayment::create($paymentData);
            });

            // ⭐ Sync AFTER commit so the pending row is visible and any
            //    sync failure does NOT roll back the payment.
            try {
                $this->syncInvoicePayment($booking);
            } catch (\Throwable $e) {
                Log::error('Mobile payment sync failed after commit', [
                    'payment_id' => $payment->payment_id,
                    'error'      => $e->getMessage(),
                ]);
            }

            $booking->unsetRelation('invoice');
            $booking->load('invoice');
            $payment->refresh();

            return $this->ok(
                $this->formatPaymentWithFullDetails($payment),
                'Mobile payment recorded. Please wait for verification.'
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Mobile payment error: ' . $e->getMessage());
            return $this->fail('Failed to record mobile payment: ' . $e->getMessage(), 500);
        }
    }

    public function verifyMobilePayment(Request $request, BookingPayment $payment)
    {
        try {
            $data = $request->validate([
                'notes' => ['nullable', 'string'],
                'amount_verified' => ['nullable', 'numeric', 'min:0'],
            ]);

            if ($payment->status === 'completed') {
                return $this->fail('Payment already verified.', 422);
            }

            $amountToVerify = $data['amount_verified'] ?? $payment->amount;

            $balance = max(0, (float) $invoice->total_amount - (float) $invoice->paid_amount);
            $requiredDeposit = round((float) $invoice->total_amount * 0.30, 2);
            $isFirstPayment = ! BookingPayment::where('booking_id', $booking->booking_id)
                ->where('status', 'completed')
                ->where('payment_type', '!=', 'refund')
                ->exists();

            // ⭐ Create notification for customer
            $this->createPaymentNotification($payment);

            Log::info('Mobile payment received — invoice synced', [
                'payment_id'     => $payment->payment_id,
                'booking_id'     => $payment->booking_id,
                'amount'         => $amountToVerify,
                'invoice_balance' => $payment->booking?->invoice?->balance,
            ]);

            $payment->refresh();
            $payment->load(['booking.invoice', 'booking.serviceEvent.customer.person', 'verifier.person']);

            return $this->ok(
                $this->formatPaymentWithFullDetails($payment),
                'Mobile payment received. Balance updated.'
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Verify mobile payment error: ' . $e->getMessage());
            return $this->fail('Failed to verify mobile payment: ' . $e->getMessage(), 500);
        }
    }

    public function rejectMobilePayment(Request $request, BookingPayment $payment)
    {
        try {
            $data = $request->validate([
                'reason' => ['required', 'string'],
            ]);

            $payment->update([
                'status' => 'failed',
                'notes' => $data['reason'],
            ]);

            $this->syncInvoicePayment($payment->booking);

            return $this->ok(
                $this->formatPaymentWithFullDetails($payment->fresh()),
                'Payment rejected.'
            );
        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->fail('Validation failed', 422, $e->errors());
        } catch (\Exception $e) {
            Log::error('Reject mobile payment error: ' . $e->getMessage());
            return $this->fail('Failed to reject mobile payment: ' . $e->getMessage(), 500);
        }
    }

    public function summary(Request $request)
    {
        try {
            $year = (int) ($request->input('year') ?? now()->year);
            $month = (int) ($request->input('month') ?? now()->month);

            $start = now()->setYear($year)->setMonth($month)->startOfMonth();
            $end = $start->copy()->endOfMonth();

            $query = BookingPayment::whereBetween('payment_date', [$start, $end]);

            return $this->ok([
                'period' => [
                    'month' => $month,
                    'year' => $year,
                    'month_name' => $start->format('F'),
                    'start_date' => $start->toDateString(),
                    'end_date' => $end->toDateString(),
                ],
                'total_amount' => $this->netCompletedAmount(clone $query),
                'total_count' => (clone $query)->count(),
                'by_method' => (clone $query)->select('payment_method')
                    ->selectRaw("SUM(CASE WHEN payment_type = 'refund' AND status = 'completed' THEN -amount WHEN payment_type != 'refund' AND status IN ('completed', 'refunded') THEN amount ELSE 0 END) total")
                    ->groupBy('payment_method')
                    ->get(),
                'daily_average' => round($this->netCompletedAmount(clone $query) / max(1, $start->daysInMonth), 2),
            ]);
        } catch (\Exception $e) {
            Log::error('Payment summary error: ' . $e->getMessage());
            return $this->fail('Failed to load payment summary: ' . $e->getMessage(), 500);
        }
    }

    // ==================== PRIVATE HELPER METHODS ====================

    /**
     * Format payment with full details
     */
    private function formatPaymentWithFullDetails(BookingPayment $payment): array
    {
        $payment->loadMissing([
            'booking.serviceEvent.customer.person',
            'booking.invoice',
            'verifier.person'
        ]);

        $booking = $payment->booking;
        $invoice = $booking?->invoice;
        $person = $booking?->serviceEvent?->customer?->person;

        // ⭐ Derive the tendered + change amounts from the notes so the
        //    receipt and Billing UI can display them without a schema change.
        $changeAmount = 0.0;
        $tenderedAmount = (float) ($payment->amount ?? 0);

        if (!empty($payment->notes)) {
            if (preg_match('/Change given:\s*₱([\d,]+(?:\.\d+)?)/i', $payment->notes, $m)) {
                $changeAmount = (float) str_replace(',', '', $m[1]);
            }
            if (preg_match('/tendered\s*₱([\d,]+(?:\.\d+)?)/i', $payment->notes, $m)) {
                $tenderedAmount = (float) str_replace(',', '', $m[1]);
            }
        }
        // ⭐ CASHIER NAME — who physically recorded / verified this payment.
        //    Priority: verified_by person → created_by user → "System".
        $cashierName = $payment->verifier?->person?->full_name;
        if (! $cashierName && $payment->verified_by) {
            $verifierUser = \App\Models\User::with('person')->find($payment->verified_by);
            $cashierName = $verifierUser?->person?->full_name
                ?: ($verifierUser?->username ?? null);
        }
        $cashierName = $cashierName ?: 'System';

        // ⭐ PAYER — person who physically paid. Falls back to the booked
        //    customer's name when no third-party payer was recorded.
        $bookedCustomerName = $person?->full_name
            ?? trim(($person?->first_name ?? '') . ' ' . ($person?->last_name ?? ''))
            ?: 'Unknown Customer';
        $payerNameRaw   = trim((string) ($payment->payer_name ?? ''));
        $payerName      = $payerNameRaw !== '' ? $payerNameRaw : $bookedCustomerName;
        $payerRelation  = trim((string) ($payment->payer_relation ?? ''));
        $isThirdPartyPayer = $payerNameRaw !== ''
            && strcasecmp($payerNameRaw, $bookedCustomerName) !== 0;

        // ⭐ BALANCE AFTER THIS PAYMENT — computed from the invoice.        //
        //    Priority:
        //      1. Invoice.balance snapshot at read time (best).
        //      2. invoice.total_amount - invoice.paid_amount.
        //      3. This payment's booking.total_amount - booking.paid_amount.
        $invoiceTotal    = (float) ($invoice?->total_amount ?? 0);
        $invoicePaid     = (float) ($invoice?->paid_amount   ?? 0);
        $bookingTotal    = (float) ($booking?->total_amount  ?? 0);
        $bookingPaid     = (float) ($booking?->paid_amount   ?? 0);

        $totalAmountForEvent = $invoiceTotal > 0 ? $invoiceTotal : $bookingTotal;
        $paidAfterPayment    = $invoiceTotal > 0 ? $invoicePaid  : $bookingPaid;
        $balanceAfterPayment = max(0, $totalAmountForEvent - $paidAfterPayment);

        // ⭐ PAYMENT CATEGORY — distinguishes a normal booking payment from
        //    an "additional" payment caused by:
        //      • damage charge (equipment damaged / missing)
        //      • extra order (client added menu items after the initial invoice)
        //      • service fee adjustment (transportation / setup)
        //
        //    The label surfaces directly in the receipt and payment tracking
        //    table so the cashier can see WHY this payment exists.
        $paymentCategory = 'standard';
        $paymentCategoryLabel = 'Standard Payment';

        $notesLower = strtolower((string) $payment->notes);
        $typeLower  = strtolower((string) $payment->payment_type);

        if ($typeLower === 'refund') {
            $paymentCategory = 'refund';
            $paymentCategoryLabel = 'Refund';
        } elseif (str_contains($notesLower, 'damage') || str_contains($notesLower, 'missing equipment')) {
            $paymentCategory = 'damage';
            $paymentCategoryLabel = 'Damage / Missing Equipment';
        } elseif (
            str_contains($notesLower, 'additional') ||
            str_contains($notesLower, 'extra order') ||
            str_contains($notesLower, 'extra food') ||
            str_contains($notesLower, 'additional charge')
        ) {
            $paymentCategory = 'additional';
            $paymentCategoryLabel = 'Additional Charge';
        } elseif ($typeLower === 'deposit') {
            $paymentCategory = 'deposit';
            $paymentCategoryLabel = 'Deposit';
        } elseif ($typeLower === 'full') {
            $paymentCategory = 'full';
            $paymentCategoryLabel = 'Full Payment';
        } elseif ($typeLower === 'partial') {
            $paymentCategory = 'partial';
            $paymentCategoryLabel = 'Partial Payment';
        }
        // ⭐ Load booking charges to inject into the payment payload
        $booking->loadMissing('charges');
        $chargesList = collect();
        if ($booking && $booking->charges) {
            $chargesList = $booking->charges->map(function ($charge) {
                return [
                    'id'          => $charge->booking_charge_id,
                    'kind'        => $charge->charge_kind,
                    'type'        => $charge->charge_type,
                    'description' => $charge->description,
                    'amount'      => (float) $charge->amount,
                ];
            })->values();
        }

        return [
            'id' => $payment->payment_id,
            'payment_id' => $payment->payment_id,
            'payment_number' => $payment->payment_number ?? 'N/A',
            'booking_id' => $payment->booking_id,
            // ⭐ Add charges to the payment object
            'charges' => $chargesList,
            'booking_no' => $booking?->booking_no ?? 'N/A',
            'customer_id' => $booking?->serviceEvent?->customer_id,
            'customer_name' => $person?->full_name ?? 'Unknown',
            'customer_email' => $person?->email ?? 'N/A',
            'customer_phone' => $person?->phone ?? 'N/A',
            'customer_avatar' => $person?->profile_photo_url,

            // ⭐ PAYER — who physically paid. Third-party payers are
            //    common (family member, driver, company rep, sponsor).
            'payer_name'           => $payerName,
            'payer_relation'       => $payerRelation ?: null,
            'is_third_party_payer' => $isThirdPartyPayer,
            'invoice_id' => $invoice?->invoice_id,
            'invoice_number' => $invoice?->invoice_number ?? 'N/A',
            'amount' => (float) ($payment->amount ?? 0),

            // ⭐ ADDED — full payment context for the receipt and the
            //    Payment Tracking table.
            'total_amount'         => round($totalAmountForEvent, 2),
            'paid_amount'          => round($paidAfterPayment, 2),
            'balance_after_payment' => round($balanceAfterPayment, 2),
            'is_fully_paid'        => $balanceAfterPayment <= 0.01,
            'payment_category'      => $paymentCategory,
            'payment_category_label' => $paymentCategoryLabel,
            'cashier_name'          => $cashierName,

            // ⭐ Overpayment / change fields — surfaced to the receipt and UI.
            'tendered_amount' => $tenderedAmount,
            'change_amount'   => $changeAmount,
            'is_exact_cash'   => $changeAmount > 0.01,
            'payment_method' => $payment->payment_method ?? 'N/A',
            'payment_type' => $payment->payment_type ?? 'partial',
            'reference_number' => $payment->reference_number ?? 'N/A',
            'account_name' => $payment->account_name ?? null,
            'account_number' => $payment->account_number ?? null,
            'transaction_id' => $payment->transaction_id ?? null,
            'status' => $payment->status ?? 'pending',
            'date' => $payment->payment_date?->toDateString(),
            'date_time' => $payment->payment_date?->toDateTimeString(),
            'notes' => $payment->notes,
            'receipt_file' => $payment->receipt_file,
            'receipt_url' => $payment->receipt_file ? Storage::disk('public')->url($payment->receipt_file) : null,
            'verified_by_id' => $payment->verified_by,
            'verified_by' => $payment->verifier?->person?->full_name,
            'verified_at' => $payment->verified_at?->toDateTimeString(),
            'is_mobile_payment' => in_array($payment->payment_method, ['gcash', 'maya', 'bank_transfer', 'card']),
            'created_at' => $payment->created_at?->toDateTimeString(),
            'updated_at' => $payment->updated_at?->toDateTimeString(),
        ];
    }

    /**
     * Sync invoice payment status
     */
    private function syncInvoicePayment(?Booking $booking): void
    {
        if (!$booking) {
            Log::warning('syncInvoicePayment called with null booking');
            return;
        }

        // ⭐ Always fetch fresh — never trust a stale relation cache.
        $booking->unsetRelation('invoice');
        $booking->load('invoice');

        // ⭐ Fallback: query directly if the relation is missing.
        $invoice = $booking->invoice
            ?: \App\Models\Invoice::where('booking_id', $booking->booking_id)->first();

        if (!$invoice) {
            Log::warning('No invoice found for booking — skipping sync', [
                'booking_id' => $booking->booking_id,
                'booking_no' => $booking->booking_no,
            ]);
            return;
        }

        $totalPaid = (float) $booking->payments()
            ->where('status', 'completed')
            ->where('payment_type', '!=', 'refund')
            ->sum('amount');

        $totalRefunded = (float) $booking->payments()
            ->where('status', 'completed')
            ->where('payment_type', 'refund')
            ->sum('amount');

        $netPaid = max(0, $totalPaid - $totalRefunded);
        $total = (float) $invoice->total_amount;

        // ⭐ Recompute status — never mark 'paid' when total is 0.
        $status = 'unpaid';
        if ($total > 0 && $netPaid >= $total - 0.01) {
            $status = 'paid';
        } elseif ($netPaid > 0) {
            $status = 'partial';
        }

        if ($status !== 'paid' && $invoice->due_date && $invoice->due_date->isPast()) {
            $status = 'overdue';
        }

        // ⭐ Skip the write if nothing actually changed.
        $currentPaid = (float) $invoice->paid_amount;
        $currentStatus = (string) $invoice->status;

        if (abs($currentPaid - $netPaid) < 0.01 && $currentStatus === $status) {
            Log::info('Invoice sync skipped — no change', [
                'invoice_id' => $invoice->invoice_id,
                'paid_amount' => $netPaid,
                'status' => $status,
            ]);
            return;
        }

        $invoice->update([
            'paid_amount' => $netPaid,
            'status'      => $status,
        ]);

        Log::info('Invoice synced', [
            'invoice_id'     => $invoice->invoice_id,
            'invoice_number' => $invoice->invoice_number,
            'booking_id'     => $booking->booking_id,
            'total_amount'   => $total,
            'net_paid'       => $netPaid,
            'balance'        => max(0, $total - $netPaid),
            'status'         => $status,
        ]);
    }

    /**
     * Create payment notification
     */
    private function createPaymentNotification(BookingPayment $payment): void
    {
        $customer = $payment->booking?->serviceEvent?->customer;

        try {
            AuditLog::log(
                $payment->status === 'completed' ? 'payment_verified' : 'payment_recorded',
                'finance',
                $payment->payment_id,
                null,
                [
                    'payment_id' => $payment->payment_id,
                    'booking_id' => $payment->booking_id,
                    'amount' => $payment->amount,
                    'status' => $payment->status,
                ]
            );
        } catch (Throwable $exception) {
            Log::warning('Payment audit log failed.', [
                'payment_id' => $payment->payment_id,
                'exception' => $exception->getMessage(),
            ]);
        }

        try {
            $notificationService = app(NotificationService::class);

            if ($customer?->user_id) {
                $notificationService->notifyUser(
                    $customer->user_id,
                    'payment_verified',
                    '💳 Payment Verification',
                    'Your payment of ₱' . number_format((float) $payment->amount, 2) . ' for booking #' . $payment->booking?->booking_no . ' has been verified.',
                    Notification::PRIORITY_HIGH,
                    [
                        'payment_id' => $payment->payment_id,
                        'booking_id' => $payment->booking_id,
                        'amount' => $payment->amount,
                        'reference_id' => $payment->payment_id,
                    ],
                    '/billing'
                );
            }

            $notificationService->notifySystemEvent(
                $payment->status === 'completed' ? 'payment_verification' : 'partial_payment_received',
                'Payment of ₱' . number_format((float) $payment->amount, 2) . ' was recorded for booking #' . $payment->booking?->booking_no . '.',
                [
                    'payment_id' => $payment->payment_id,
                    'booking_id' => $payment->booking_id,
                    'amount' => $payment->amount,
                    'reference_id' => $payment->payment_id,
                ],
                ['admin']
            );
        } catch (Throwable $exception) {
            Log::warning('Payment was recorded, but its notification could not be saved.', [
                'payment_id' => $payment->payment_id,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * Generate receipt PDF
     */
    private function generateReceiptPDF(BookingPayment $payment)
    {
        return $this->generateReceiptHTML($payment);
    }

    /**
     * Generate receipt HTML
     */
    private function generateReceiptHTML(BookingPayment $payment): string
    {
        $payment->loadMissing([
            'booking.serviceEvent.customer.person',
            'booking.serviceEvent.eventType',
            'booking.invoice',
            'booking.quotation',
            'booking.payments',
        ]);

        $booking  = $payment->booking;
        $event    = $booking?->serviceEvent;
        $person   = $event?->customer?->person;
        $invoice  = $booking?->invoice;
        $quotation = $booking?->quotation;

        $money = fn($value) => '₱' . number_format((float) ($value ?? 0), 2);
        $safe  = fn($value) => e((string) ($value ?? 'N/A'));

        $customerName = $person?->full_name
            ?? trim(($person?->first_name ?? '') . ' ' . ($person?->last_name ?? ''))
            ?: 'Unknown Customer';
        $eventName = $event?->eventType?->name ?? 'Event';
        $bookingNo = $booking?->booking_no ?? 'N/A';

        // ⭐ PAYMENT DATE & TIME — always shown on the trimmed receipt.
        $paymentDate = $payment->payment_date?->format('F d, Y') ?? optional($payment->created_at)->format('F d, Y') ?? 'N/A';
        $paymentTime = $payment->payment_date?->format('h:i A') ?? optional($payment->created_at)->format('h:i A') ?? 'N/A';
        $paymentDateTime = $payment->payment_date?->format('F d, Y · h:i A')
            ?? optional($payment->created_at)->format('F d, Y · h:i A')
            ?? 'N/A';
        $generatedDate = now()->format('F d, Y h:i A');

        // ⭐ CASHIER NAME — who physically recorded / verified this payment.
        $cashierName = $payment->verifier?->person?->full_name;
        if (! $cashierName && $payment->verified_by) {
            $verifierUser = \App\Models\User::with('person')->find($payment->verified_by);
            $cashierName = $verifierUser?->person?->full_name
                ?: ($verifierUser?->username ?? null);
        }
        $cashierName = $cashierName ?: 'System';

        // ⭐ TOTALS — the three numbers the cashier ALWAYS needs:
        //    • Grand Total of the event
        //    • Amount Paid (this payment)
        //    • Balance After This Payment
        $grandTotal = (float) ($invoice?->total_amount ?? $quotation?->total_amount ?? 0);

        // Paid BEFORE this payment = invoice.paid_amount minus this payment
        // (only when this payment is already reflected in invoice.paid_amount).
        $invoicePaid = (float) ($invoice?->paid_amount ?? 0);
        $thisPayment = (float) ($payment->amount ?? 0);

        $completedSum = (float) ($booking?->payments ?? collect())
            ->where('status', 'completed')
            ->where('payment_type', '!=', 'refund')
            ->sum('amount');
        $refundSum = (float) ($booking?->payments ?? collect())
            ->where('status', 'completed')
            ->where('payment_type', 'refund')
            ->sum('amount');
        $netPaid = max(0, $completedSum - $refundSum);

        // After this payment = the net paid across the booking.
        // If the backend already rolled this payment into invoice.paid_amount,
        // use that. Otherwise add this payment on top of the current paid.
        $paidAfterPayment = $invoicePaid > 0 ? $invoicePaid : $netPaid;
        $balanceAfterPayment = max(0, $grandTotal - $paidAfterPayment);

        // ⭐ PAYMENT CATEGORY — labels the reason for this payment so the
        //    receipt makes it clear when the client is paying for an extra
        //    order, damage, or a normal partial payment.
        $notesLower = strtolower((string) $payment->notes);
        $typeLower  = strtolower((string) $payment->payment_type);

        $categoryLabel = 'Standard Payment';
        $categoryTone  = '#1a7ab5'; // default blue
        if ($typeLower === 'refund') {
            $categoryLabel = 'Refund';
            $categoryTone  = '#d97706';
        } elseif (str_contains($notesLower, 'damage') || str_contains($notesLower, 'missing equipment')) {
            $categoryLabel = 'Damage / Missing Equipment';
            $categoryTone  = '#dc2626';
        } elseif (
            str_contains($notesLower, 'additional') ||
            str_contains($notesLower, 'extra order') ||
            str_contains($notesLower, 'extra food') ||
            str_contains($notesLower, 'additional charge')
        ) {
            $categoryLabel = 'Additional Charge';
            $categoryTone  = '#7c3aed';
        } elseif ($typeLower === 'deposit') {
            $categoryLabel = 'Deposit';
            $categoryTone  = '#2563eb';
        } elseif ($typeLower === 'full') {
            $categoryLabel = 'Full Payment';
            $categoryTone  = '#059669';
        } elseif ($typeLower === 'partial') {
            $categoryLabel = 'Partial Payment';
            $categoryTone  = '#d97706';
        }

        // ⭐ Extract tendered / change for the cash summary.
        $tenderedAmount = (float) ($payment->amount ?? 0);
        $changeAmount   = 0.0;
        if (!empty($payment->notes)) {
            if (preg_match('/Change given:\s*₱([\d,]+(?:\.\d+)?)/i', $payment->notes, $m)) {
                $changeAmount = (float) str_replace(',', '', $m[1]);
            }
            if (preg_match('/tendered\s*₱([\d,]+(?:\.\d+)?)/i', $payment->notes, $m)) {
                $tenderedAmount = (float) str_replace(',', '', $m[1]);
            }
        }

        // ⭐ GENERATE ADDITIONAL CHARGES ROWS
        $booking->loadMissing('charges');
        $chargesRowsHtml = '';

        if ($booking && $booking->charges && $booking->charges->count() > 0) {
            foreach ($booking->charges as $charge) {
                if ($charge->amount > 0) {
                    $label = $charge->description ?: ucwords(str_replace('_', ' ', $charge->charge_type));
                    $prefix = $charge->charge_kind === 'discount' ? '-' : '';
                    $color = $charge->charge_kind === 'discount' ? '#059669' : '#1e293b';

                    $chargesRowsHtml .= '
                        <div class="summary-row" style="border-bottom: 1px dashed #e2e8f0; padding: 4px 0; font-size: 12px;">
                            <span style="color: #64748b;">' . $safe($label) . '</span>
                            <strong style="color: ' . $color . ';">' . $prefix . $money($charge->amount) . '</strong>
                        </div>
                    ';
                }
            }
        }

        $accountRows = '';
        if ($payment->account_name) {
            $accountRows .= '<tr><td>Account Name</td><td>' . $safe($payment->account_name) . '</td></tr>';
        }
        if ($payment->account_number) {
            $accountRows .= '<tr><td>Account Number</td><td>' . $safe($payment->account_number) . '</td></tr>';
        }

        $notes = $payment->notes
            ? '<div class="notes"><strong>Notes:</strong><br>' . nl2br(e($payment->notes)) . '</div>'
            : '';

        // ⭐ OPTIONAL CHANGE ROWS — cash payments show the tendered and
        //    change returned so the customer can verify their money.
        $changeRowsHtml = '';
        if ($changeAmount > 0.01) {
            $changeRowsHtml .= '<tr><td><strong>Cash Tendered</strong></td><td style="text-align:right;font-weight:600;">' . $money($tenderedAmount) . '</td></tr>';
            $changeRowsHtml .= '<tr style="background:#ecfdf5;"><td><strong style="color:#059669;">Change</strong></td><td style="text-align:right;font-weight:700;color:#059669;">' . $money($changeAmount) . '</td></tr>';
        }

        // ⭐ COLOR for the balance chip: green when settled, red when owing.
        $balanceColor = $balanceAfterPayment <= 0.01 ? '#059669' : '#dc2626';
        $balanceLabel = $balanceAfterPayment <= 0.01 ? 'FULLY PAID' : 'BALANCE';

        // ⭐ PAYER — only rendered when a third party paid.
        $payerNameRaw  = trim((string) ($payment->payer_name ?? ''));
        $payerRelation = trim((string) ($payment->payer_relation ?? ''));
        $bookedName    = $person?->full_name
            ?? trim(($person?->first_name ?? '') . ' ' . ($person?->last_name ?? ''))
            ?: 'Unknown Customer';
        $isThirdParty  = $payerNameRaw !== ''
            && strcasecmp($payerNameRaw, $bookedName) !== 0;

        $payerSectionHtml = '';
        if ($isThirdParty) {
            $safePayer    = $safe($payerNameRaw);
            $safeRelation = $safe($payerRelation);
            $safeBooked   = $safe($bookedName);

            $payerSectionHtml = '
                <div class="section-title">Paid By</div>
                <div style="padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px;">
                        <div>
                            <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #64748b;">Received From</div>
                            <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 2px;">' . $safePayer . '</div>
                        </div>'
                . ($safeRelation !== ''
                    ? '<div style="text-align: right;">
                            <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #64748b;">Relationship</div>
                            <div style="font-size: 13px; font-weight: 600; color: #7c3aed; margin-top: 2px;">' . $safeRelation . '</div>
                       </div>'
                    : '')
                . '</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #fde68a;">
                        Booking on file under <strong style="color: #64748b;">' . $safeBooked . '</strong>
                    </div>
                </div>
            ';
        }

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Payment Receipt - {$safe($payment->payment_number)}</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #111827; background: #f8fafc; }
        .receipt-container { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px 32px; border: 1px solid #e2e8f0; }

        .receipt-header { text-align: center; border-bottom: 2px solid #1a7ab5; padding-bottom: 16px; margin-bottom: 20px; }
        .receipt-header h1 { color: #1a7ab5; margin: 0 0 4px; font-size: 22px; letter-spacing: 1px; }
        .receipt-header .subtitle { color: #64748b; font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; }
        .receipt-header .receipt-id { font-family: 'Courier New', monospace; font-weight: 700; color: #1e293b; font-size: 14px; margin-top: 6px; }

        .category-banner { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 8px; margin-bottom: 18px; background: #eff6ff; border: 1px solid #bfdbfe; }
        .category-banner .cat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #64748b; }
        .category-banner .cat-value { font-size: 13px; font-weight: 700; color: {$categoryTone}; }

        .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #64748b; margin: 18px 0 8px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }

        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        table tr:last-child td { border-bottom: none; }
        table td:first-child { color: #64748b; font-weight: 500; width: 42%; }
        table td:last-child  { color: #1e293b; font-weight: 600; text-align: right; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

        .summary-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 20px; margin-top: 8px; }
        .summary-box .summary-row { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 0; border-bottom: 1px dashed #bfdbfe; font-size: 13px; }
        .summary-box .summary-row:last-child { border-bottom: none; }
        .summary-box .summary-row span { color: #475569; font-weight: 500; }
        .summary-box .summary-row strong { color: #1e293b; font-weight: 700; font-variant-numeric: tabular-nums; }
        .summary-box .summary-row.grand { padding: 12px 0 8px; border-top: 2px solid #1a7ab5; margin-top: 6px; }
        .summary-box .summary-row.grand strong { font-size: 20px; color: #1a7ab5; }
        .summary-box .summary-row.balance-row { padding: 14px 12px; margin-top: 8px; border-radius: 8px; background: #fff; border: 1px solid {$balanceColor}33; }
        .summary-box .summary-row.balance-row strong { font-size: 18px; color: {$balanceColor}; }
        .summary-box .summary-row.balance-row .bal-label { color: {$balanceColor}; font-weight: 700; }

        .cashier-box { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; margin-top: 18px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
        .cashier-box .cashier-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #64748b; }
        .cashier-box .cashier-name { font-size: 14px; font-weight: 700; color: #1e293b; }
        .cashier-box .cashier-time { font-size: 11.5px; color: #64748b; margin-top: 2px; }

        .notes { margin-top: 16px; padding: 12px 14px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 12.5px; }

        .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; }
        .footer p { margin: 3px 0; }

        @media print {
            body { background: #fff; padding: 0; }
            .receipt-container { border: none; box-shadow: none; padding: 12mm 10mm; max-width: 100%; }
        }
    </style>
</head>
<body>
<div class="receipt-container">
    <div class="receipt-header">
        <h1>PAYMENT RECEIPT</h1>
        <div class="subtitle">Dear Bab's Catering Services</div>
        <div class="receipt-id">{$safe($payment->payment_number)}</div>
    </div>

    <div class="category-banner">
        <span class="cat-label">Payment Category</span>
        <span class="cat-value">{$safe($categoryLabel)}</span>
    </div>
    <div class="grid">
        <div>
            <div class="section-title">Customer</div>
            <table>
                <tr><td>Customer Name</td><td>{$safe($customerName)}</td></tr>
                <tr><td>Contact</td><td>{$safe($person?->phone ?? 'N/A')}</td></tr>
                <tr><td>Email</td><td>{$safe($person?->email ?? 'N/A')}</td></tr>
            </table>
        </div>
        <div>
            <div class="section-title">Event</div>
            <table>
                <tr><td>Booking #</td><td>{$safe($bookingNo)}</td></tr>
                <tr><td>Event Type</td><td>{$safe($eventName)}</td></tr>
                <tr><td>Event Date</td><td>{$safe(optional($event?->event_date)->format('M d, Y'))}</td></tr>
            </table>
        </div>
    </div>

    {$payerSectionHtml}
    <div class="section-title">Payment Details</div>
    <table>
        <tr><td>Receipt #</td><td>{$safe($payment->payment_number)}</td></tr>
        <tr><td>Payment Date</td><td>{$safe($paymentDate)}</td></tr>
        <tr><td>Payment Time</td><td>{$safe($paymentTime)}</td></tr>
        <tr><td>Payment Method</td><td>{$safe(strtoupper(str_replace('_', ' ', (string)$payment->payment_method)))}</td></tr>
        <tr><td>Payment Type</td><td>{$safe(strtoupper(str_replace('_', ' ', (string)$payment->payment_type)))}</td></tr>
        <tr><td>Reference #</td><td>{$safe($payment->reference_number ?? 'N/A')}</td></tr>
        <tr><td>Status</td><td>{$safe(strtoupper($payment->status ?? 'COMPLETED'))}</td></tr>
        {$accountRows}
    </table>

    <div class="section-title">Amount Summary</div>
    <div class="summary-box">
        <div class="summary-row">
            <span>Grand Total (Event)</span>
            <strong>{$money($grandTotal)}</strong>
        </div>
        
        <!-- ⭐ ADDITIONAL CHARGES BREAKDOWN -->
        {$chargesRowsHtml}
        
        <div class="summary-row grand">
            <span>Amount Paid (This Payment)</span>
            <strong>{$money($thisPayment)}</strong>
        </div>
        <div class="summary-row">
            <span>Total Paid to Date</span>
            <strong>{$money($paidAfterPayment)}</strong>
        </div>
        <div class="summary-row balance-row">
            <span class="bal-label">{$safe($balanceLabel)}</span>
            <strong>{$money($balanceAfterPayment)}</strong>
        </div>
        {$changeRowsHtml}
    </div>

    <div class="cashier-box">
        <div>
            <div class="cashier-label">Cashier / Recorded By</div>
            <div class="cashier-name">{$safe($cashierName)}</div>
        </div>
        <div style="text-align:right;">
            <div class="cashier-label">Payment Date & Time</div>
            <div class="cashier-time">{$safe($paymentDateTime)}</div>
        </div>
    </div>

    {$notes}

    <div class="footer">
        <p>Thank you for your business. This is a system-generated receipt.</p>
        <p>Generated on: {$safe($generatedDate)}</p>
    </div>
</div>
</body>
</html>
HTML;
    }
    /**
     * Calculate net completed amount
     */
    private function netCompletedAmount(Builder $query): float
    {
        return (float) $query->selectRaw("
            COALESCE(SUM(
                CASE 
                    WHEN payment_type = 'refund' AND status = 'completed' THEN -amount 
                    WHEN payment_type != 'refund' AND status IN ('completed', 'refunded') THEN amount 
                    ELSE 0 
                END
            ), 0) total
        ")->value('total');
    }
}
