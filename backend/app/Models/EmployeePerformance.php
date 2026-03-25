<?php
// app/Models/EmployeePerformance.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeePerformance extends Model
{
    use HasFactory;

    protected $table = 'employee_performance';

    protected $fillable = [
        'performance_id',
        'employee_id',
        'review_date',
        'review_period',
        'attendance_score',
        'productivity_score',
        'quality_score',
        'teamwork_score',
        'customer_feedback_score',
        'overall_score',
        'strengths',
        'areas_for_improvement',
        'comments',
        'achievements',
        'goals',
        'reviewed_by',
        'status'
    ];

    protected $casts = [
        'review_date' => 'date',
        'attendance_score' => 'integer',
        'productivity_score' => 'integer',
        'quality_score' => 'integer',
        'teamwork_score' => 'integer',
        'customer_feedback_score' => 'integer',
        'overall_score' => 'integer',
        'achievements' => 'array',
        'goals' => 'array'
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(Employee::class, 'reviewed_by');
    }

    public function getRatingAttribute()
    {
        if ($this->overall_score >= 90) return 'Excellent';
        if ($this->overall_score >= 75) return 'Good';
        if ($this->overall_score >= 60) return 'Satisfactory';
        if ($this->overall_score >= 40) return 'Needs Improvement';
        return 'Poor';
    }
}
