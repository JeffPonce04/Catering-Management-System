<?php
// app/Models/EmployeeTraining.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeTraining extends Model
{
    use HasFactory;

    protected $table = 'employee_training';

    protected $fillable = [
        'training_id',
        'training_name',
        'description',
        'start_date',
        'end_date',
        'duration_hours',
        'provider',
        'location',
        'status',
        'participants',
        'trainers',
        'materials',
        'notes',
        'certificates'
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'duration_hours' => 'integer',
        'participants' => 'array',
        'trainers' => 'array',
        'materials' => 'array',
        'certificates' => 'array'
    ];

    public function getIsOngoingAttribute()
    {
        return $this->status === 'ongoing';
    }

    public function getIsCompletedAttribute()
    {
        return $this->status === 'completed';
    }

    public function getParticipantCountAttribute()
    {
        return count($this->participants ?? []);
    }
}
