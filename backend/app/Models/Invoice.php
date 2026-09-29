<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    protected $table = 'invoices';
    protected $primaryKey = 'invoice_id';
    protected $guarded = [];

    protected $casts = [
        'subtotal' => 'float',
        'discount' => 'float',
        'additional_charges' => 'float',
        'total_amount' => 'float',
        'paid_amount' => 'float',
        'due_date' => 'date',
    ];

    protected $appends = ['balance', 'status_badge'];

    // IMPORTANT: The relationship name must match what's used in the controller
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'booking_id');
    }

    public function getBalanceAttribute(): float
    {
        return max(0, (float) $this->total_amount - (float) $this->paid_amount);
    }

    public function getStatusBadgeAttribute(): string
    {
        if ((float) $this->paid_amount >= (float) $this->total_amount) {
            return 'paid';
        }

        if ($this->due_date && $this->due_date->isPast()) {
            return 'overdue';
        }

        return (float) $this->paid_amount > 0 ? 'partial' : 'unpaid';
    }

    /**
     * ⭐ Generate the next invoice number.
     *
     * Format:  INV-YYYYMMDD-NNNN
     * Example: INV-20260929-0001
     *
     * Rules:
     *   • The date part is today's date (YYYYMMDD).
     *   • The 4-digit sequence restarts at 0001 each day.
     *   • The counter picks up from the highest sequence already issued
     *     today (including soft-deleted rows) so deletions never collide.
     *
     * Usage:
     *   $invoiceNumber = Invoice::nextInvoiceNumber();
     */
    public static function nextInvoiceNumber(): string
    {
        $prefix = 'INV-' . now()->format('Ymd') . '-';

        $lastInvoice = static::withTrashed()
            ->where('invoice_number', 'like', $prefix . '%')
            ->orderByDesc('invoice_number')
            ->first();

        $nextSequence = 1;

        if ($lastInvoice && preg_match('/-(\d+)$/', (string) $lastInvoice->invoice_number, $matches)) {
            $nextSequence = ((int) $matches[1]) + 1;
        }

        return $prefix . str_pad((string) $nextSequence, 4, '0', STR_PAD_LEFT);
    }
}
