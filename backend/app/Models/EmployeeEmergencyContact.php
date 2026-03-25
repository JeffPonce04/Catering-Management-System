<?php
// app/Models/EmployeeEmergencyContact.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeEmergencyContact extends Model
{
    use HasFactory;

    protected $table = 'employee_emergency_contacts';

    protected $fillable = [
        'employee_id',
        'contact_name',
        'relationship',
        'phone',
        'alternative_phone',
        'email',
        'address',
        'is_primary'
    ];

    protected $casts = [
        'is_primary' => 'boolean'
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
}
