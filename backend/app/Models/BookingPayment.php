<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BookingPayment extends Model
{
    use SoftDeletes;

    protected $table = 'booking_payments';
    protected $primaryKey = 'payment_id';
    protected $guarded = [];

    protected $casts = [
        'amount' => 'float',
        'payment_date' => 'datetime',
        'verified_at' => 'datetime',
    ];

    /**
     * ⭐ Display name for the payer — falls back to the booked
     *    customer's name when no third-party payer was recorded.
     */
    public function getDisplayPayerAttribute(): string
    {
        $payer = trim((string) ($this->payer_name ?? ''));
        if ($payer !== '') {
            return $payer;
        }
        return $this->booking?->serviceEvent?->customer?->person?->full_name
            ?? 'Unknown Customer';
    }

    /**
     * ⭐ True when someone other than the booked customer paid.
     */
    public function getIsThirdPartyPayerAttribute(): bool
    {
        $payer = trim((string) ($this->payer_name ?? ''));
        if ($payer === '') {
            return false;
        }
        $customer = $this->booking?->serviceEvent?->customer?->person?->full_name ?? '';
        return strcasecmp($payer, $customer) !== 0;
    }

    // Relationships
    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id', 'booking_id');
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by', 'user_id');
    }
}
