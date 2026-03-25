<?php
// app/Models/Department.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Department extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'department_id',
        'name',
        'code',
        'description',
        'head_position',
        'employee_count',
        'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'employee_count' => 'integer'
    ];

    public function positions()
    {
        return $this->hasMany(Position::class);
    }

    public function employees()
    {
        return $this->hasMany(Employee::class);
    }

    public function getFullNameAttribute()
    {
        return "{$this->code} - {$this->name}";
    }
}
