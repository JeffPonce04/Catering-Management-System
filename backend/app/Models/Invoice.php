<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Invoice extends Model
{
    use SoftDeletes;

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
    /**
     * ⭐ Generate the next invoice number.
     *
     * Format:  INV-NNNNNNNNN
     * Example: INV-000000351
     *
     * Rules:
     *   • 9-digit sequential counter, shared across all days.
     *   • Uses MAX() so deleted rows don't cause collisions.
     *
     * ⚠️ This method alone is NOT atomic against concurrent inserts.
     *    The caller MUST wrap this + the Invoice::create() call inside
     *    the same DB::transaction() and handle the 1062 duplicate-key
     *    case by retrying. See InvoiceController::store().
     */
    public static function nextInvoiceNumber(): string
    {
        $prefix = 'INV-';

        // ⭐ MAX() is stable even if the latest row was soft-deleted.
        //    orderByDesc('invoice_number') on a soft-deleted row would
        //    skip it and produce a duplicate. MAX() reads all rows
        //    including trashed ones because we use withTrashed().
        $maxNumber = static::withTrashed()
            ->where('invoice_number', 'like', $prefix . '%')
            ->selectRaw("MAX(CAST(SUBSTRING(invoice_number, " . (strlen($prefix) + 1) . ") AS UNSIGNED)) as max_num")
            ->value('max_num');

        $nextSequence = ((int) ($maxNumber ?? 0)) + 1;

        // ⭐ Always 9 digits — INV-000000001
        return $prefix . str_pad((string) $nextSequence, 9, '0', STR_PAD_LEFT);
    }
}
