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
}