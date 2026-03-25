<?php
// app/Models/EmployeeAttendance.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeAttendance extends Model
{
    use HasFactory;

    protected $table = 'employee_attendance';

    protected $fillable = [
        'attendance_id',
        'employee_id',
        'date',
        'shift',
        'check_in',
        'check_out',
        'total_hours',
        'overtime_hours',
        'late_minutes',
        'early_leave_minutes',
        'check_in_selfie',
        'check_out_selfie',
        'location_data',
        'status',
        'attendance_type',
        'notes',
        'metadata'
    ];

    protected $casts = [
        'date' => 'date',
        'check_in' => 'datetime',
        'check_out' => 'datetime',
        'total_hours' => 'decimal:2',
        'overtime_hours' => 'decimal:2',
        'late_minutes' => 'integer',
        'early_leave_minutes' => 'integer',
        'location_data' => 'array',
        'metadata' => 'array'
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function getDurationAttribute()
    {
        if ($this->check_in && $this->check_out) {
            return $this->check_out->diffInHours($this->check_in);
        }
        return 0;
    }

    public function getIsLateAttribute()
    {
        return $this->late_minutes > 0;
    }

    public function getIsOvertimeAttribute()
    {
        return $this->overtime_hours > 0;
    }
}
