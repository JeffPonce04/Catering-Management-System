<?php
// app/Models/Position.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Position extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'position_id',
        'title',
        'department_id',
        'description',
        'responsibilities',
        'requirements',
        'base_salary',
        'hourly_rate',
        'employment_type',
        'max_hours_per_week',
        'is_active'
    ];

    protected $casts = [
        'responsibilities' => 'array',
        'requirements' => 'array',
        'base_salary' => 'decimal:2',
        'hourly_rate' => 'decimal:2',
        'max_hours_per_week' => 'integer',
        'is_active' => 'boolean'
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function employees()
    {
        return $this->hasMany(Employee::class);
    }

    public function getFullTitleAttribute()
    {
        return "{$this->title} ({$this->department->code})";
    }
}
