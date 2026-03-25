<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OtpVerification extends Model
{
    use HasFactory;

    protected $table = 'otp_verifications';

    protected $fillable = [
        'phone_number',
        'country_code',
        'otp_code',
        'type',
        'status',
        'attempts',
        'expires_at',
        'verified_at'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'verified_at' => 'datetime',
        'attempts' => 'integer'
    ];

    public function isValid()
    {
        return $this->status === 'pending' &&
            $this->expires_at->isFuture() &&
            $this->attempts < 5;
    }

    public function isExpired()
    {
        return $this->expires_at->isPast() || $this->status === 'expired';
    }

    public function markAsVerified()
    {
        $this->status = 'verified';
        $this->verified_at = now();
        $this->save();
    }

    public function incrementAttempts()
    {
        $this->increment('attempts');

        if ($this->attempts >= 5) {
            $this->status = 'expired';
        }

        $this->save();
    }
}
