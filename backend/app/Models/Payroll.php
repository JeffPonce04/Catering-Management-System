<?php
// app/Models/Payroll.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payroll extends Model
{
    use HasFactory;

    protected $table = 'payroll';

    protected $fillable = [
        'payroll_id',
        'employee_id',
        'payroll_period_id',
        'regular_hours',
        'overtime_hours',
        'holiday_hours',
        'late_hours',
        'total_hours',
        'base_pay',
        'overtime_pay',
        'holiday_pay',
        'allowances',
        'bonuses',
        'gross_pay',
        'tax',
        'sss',
        'philhealth',
        'pagibig',
        'late_deductions',
        'other_deductions',
        'total_deductions',
        'net_pay',
        'payment_method',
        'bank_name',
        'bank_account',
        'check_number',
        'payment_date',
        'status',
        'notes',
        'metadata'
    ];

    protected $casts = [
        'regular_hours' => 'decimal:2',
        'overtime_hours' => 'decimal:2',
        'holiday_hours' => 'decimal:2',
        'late_hours' => 'decimal:2',
        'total_hours' => 'decimal:2',
        'base_pay' => 'decimal:2',
        'overtime_pay' => 'decimal:2',
        'holiday_pay' => 'decimal:2',
        'allowances' => 'decimal:2',
        'bonuses' => 'decimal:2',
        'gross_pay' => 'decimal:2',
        'tax' => 'decimal:2',
        'sss' => 'decimal:2',
        'philhealth' => 'decimal:2',
        'pagibig' => 'decimal:2',
        'late_deductions' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'net_pay' => 'decimal:2',
        'payment_date' => 'date',
        'metadata' => 'array'
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function payrollPeriod()
    {
        return $this->belongsTo(PayrollPeriod::class);
    }

    public function getDeductionRateAttribute()
    {
        return $this->gross_pay > 0
            ? round(($this->total_deductions / $this->gross_pay) * 100, 2)
            : 0;
    }

    public function getIsPaidAttribute()
    {
        return $this->status === 'paid';
    }
}
