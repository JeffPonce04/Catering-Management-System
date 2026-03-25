<?php
// app/Models/PayrollPeriod.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PayrollPeriod extends Model
{
    use HasFactory;

    protected $table = 'payroll_periods';

    protected $fillable = [
        'period_id',
        'name',
        'start_date',
        'end_date',
        'cutoff_date',
        'payment_date',
        'status',
        'notes',
        'metadata'
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'cutoff_date' => 'date',
        'payment_date' => 'date',
        'metadata' => 'array'
    ];

    public function payroll()
    {
        return $this->hasMany(Payroll::class, 'payroll_period_id');
    }

    public function getTotalGrossPayAttribute()
    {
        return $this->payroll()->sum('gross_pay');
    }

    public function getTotalNetPayAttribute()
    {
        return $this->payroll()->sum('net_pay');
    }

    public function getEmployeeCountAttribute()
    {
        return $this->payroll()->count();
    }
}
