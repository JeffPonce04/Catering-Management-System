<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LeaveRequest extends Model
{
    use SoftDeletes;

    protected $table = 'leave_requests';
    protected $primaryKey = 'leave_request_id';
    protected $guarded = [];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'approved_at' => 'datetime',
    ];

    protected $appends = [
        'id',
        'type',
        'employee_name',
        'employee_code',
        'request_date',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id', 'employee_id');
    }

    public function getIdAttribute()
    {
        return $this->leave_request_id;
    }

    public function getTypeAttribute(): ?string
    {
        return $this->request_type;
    }

    public function getEmployeeNameAttribute(): string
    {
        return $this->employee?->full_name ?: 'N/A';
    }

    public function getEmployeeCodeAttribute(): ?string
    {
        return $this->employee?->employee_code;
    }

    public function getRequestDateAttribute(): ?string
    {
        return $this->created_at?->toDateString();
    }
}
