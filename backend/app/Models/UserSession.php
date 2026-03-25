<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'session_token',
        'device_type',
        'device_name',
        'browser',
        'platform',
        'ip_address',
        'user_agent',
        'location',
        'is_active',
        'last_activity',
        'expires_at'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_activity' => 'datetime',
        'expires_at' => 'datetime'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isValid()
    {
        return $this->is_active && $this->expires_at->isFuture();
    }
}
