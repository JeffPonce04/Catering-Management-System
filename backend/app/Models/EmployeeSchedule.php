<?php
// app/Models/EmployeeSchedule.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeSchedule extends Model
{
    use HasFactory;

    protected $table = 'employee_schedules';

    protected $fillable = [
        'schedule_id',
        'employee_id',
        'date',
        'start_time',
        'end_time',
        'shift_type',
        'status',
        'scheduled_hours',
        'actual_hours',
        'break_hours',
        'assigned_area',
        'supervisor',
        'tasks',
        'notes',
        'metadata'
    ];

    protected $casts = [
        'date' => 'date',
        'start_time' => 'datetime',
        'end_time' => 'datetime',
        'scheduled_hours' => 'decimal:2',
        'actual_hours' => 'decimal:2',
        'break_hours' => 'decimal:2',
        'tasks' => 'array',
        'metadata' => 'array'
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function getIsCompletedAttribute()
    {
        return $this->status === 'completed';
    }

    public function getIsOverdueAttribute()
    {
        return $this->status === 'scheduled' && $this->date < now();
    }
}
