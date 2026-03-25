<?php
// app/Models/EmployeeCertification.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeCertification extends Model
{
    use HasFactory;

    protected $table = 'employee_certifications';

    protected $fillable = [
        'employee_id',
        'certification_name',
        'issuing_organization',
        'issue_date',
        'expiry_date',
        'credential_id',
        'credential_url',
        'is_verified',
        'metadata'
    ];

    protected $casts = [
        'issue_date' => 'date',
        'expiry_date' => 'date',
        'is_verified' => 'boolean',
        'metadata' => 'array'
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function getIsExpiredAttribute()
    {
        return $this->expiry_date && $this->expiry_date < now();
    }

    public function getIsValidAttribute()
    {
        return !$this->is_expired && $this->is_verified;
    }
}
