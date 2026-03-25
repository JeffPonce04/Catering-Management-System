<?php
// app/Models/EmployeeSkill.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeSkill extends Model
{
    use HasFactory;

    protected $table = 'employee_skills';

    protected $fillable = [
        'employee_id',
        'skill_name',
        'proficiency',
        'years_experience',
        'is_certified',
        'notes'
    ];

    protected $casts = [
        'years_experience' => 'integer',
        'is_certified' => 'boolean'
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function getProficiencyLevelAttribute()
    {
        $levels = [
            'beginner' => 1,
            'intermediate' => 2,
            'advanced' => 3,
            'expert' => 4
        ];
        return $levels[$this->proficiency] ?? 0;
    }
}
