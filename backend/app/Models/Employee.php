<?php
// app/Models/Employee.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use HasFactory, SoftDeletes;

    // app/Models/Employee.php
    protected $fillable = [
        'employee_id',
        'first_name',
        'last_name',
        'middle_name',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'postal_code',
        'country',
        'department_id',
        'position_id',
        'employee_type',
        'status',
        'hire_date',
        'shift_preference',
        'monthly_salary',
        'emergency_contact',
        'emergency_relation',
        'emergency_phone',
        'sss',
        'philhealth',
        'pagibig',
        'tin',
        'bank_name',
        'bank_account',
        'birth_date',
        'gender',
        'skills',
        'certifications',
        'achievements',
        'notes',
        'profile_photo',
        'is_bookmarked',
        'last_login',
        'login_count'
    ];
    protected $casts = [
        'availability' => 'array',
        'documents' => 'array',
        'skills' => 'array',
        'certifications' => 'array',
        'achievements' => 'array',
        'hire_date' => 'date',
        'regularization_date' => 'date',
        'exit_date' => 'date',
        'birth_date' => 'date',
        'last_login' => 'datetime',
        'hourly_rate' => 'decimal:2',
        'monthly_salary' => 'decimal:2',
        'max_hours_per_week' => 'integer',
        'login_count' => 'integer',
        'is_bookmarked' => 'boolean'
    ];

    protected $appends = ['full_name', 'initials', 'age', 'years_of_service'];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function position()
    {
        return $this->belongsTo(Position::class);
    }

    public function attendance()
    {
        return $this->hasMany(EmployeeAttendance::class);
    }

    public function leaves()
    {
        return $this->hasMany(EmployeeLeave::class);
    }

    public function schedules()
    {
        return $this->hasMany(EmployeeSchedule::class);
    }

    public function payroll()
    {
        return $this->hasMany(Payroll::class);
    }

    public function performance()
    {
        return $this->hasMany(EmployeePerformance::class);
    }

    public function employeeDocuments()
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function employeeCertifications()
    {
        return $this->hasMany(EmployeeCertification::class);
    }

    public function employeeSkills()
    {
        return $this->hasMany(EmployeeSkill::class);
    }

    public function emergencyContacts()
    {
        return $this->hasMany(EmployeeEmergencyContact::class);
    }

    public function getFullNameAttribute()
    {
        return trim("{$this->first_name} {$this->middle_name} {$this->last_name}");
    }

    public function getInitialsAttribute()
    {
        $first = substr($this->first_name, 0, 1);
        $last = substr($this->last_name, 0, 1);
        return strtoupper($first . $last);
    }

    public function getAgeAttribute()
    {
        return $this->birth_date ? $this->birth_date->age : null;
    }

    public function getYearsOfServiceAttribute()
    {
        return $this->hire_date ? $this->hire_date->diffInYears(now()) : 0;
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeRegular($query)
    {
        return $query->where('employee_type', 'regular');
    }

    public function scopeOnCall($query)
    {
        return $query->where('employee_type', 'oncall');
    }

    public function scopeBookmarked($query)
    {
        return $query->where('is_bookmarked', true);
    }
}
