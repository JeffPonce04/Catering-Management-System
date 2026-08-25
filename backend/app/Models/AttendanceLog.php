<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class AttendanceLog extends Model
{
    use SoftDeletes;

    protected $table = 'attendance_logs';
    protected $primaryKey = 'attendance_id';
    protected $guarded = [];

    protected $casts = [
        'attendance_date' => 'date',
        'time_in' => 'datetime',
        'time_out' => 'datetime',
        'break_start' => 'datetime',
        'break_end' => 'datetime',
        'approved_at' => 'datetime',
        'face_verified' => 'boolean',
        'overtime_approved' => 'boolean',
        'regular_hours' => 'float',
        'overtime_hours' => 'float',
        'undertime_hours' => 'float',
    ];

    protected $appends = [
        'id',
        'employee_name',
        'employee_code',
        'department',
        'verification_status',
        'formatted_date',
        'formatted_time_in',
        'formatted_time_out',
        'timestamp',
        'type',
        'selfie_url',
        'time_in_selfie_url',
        'time_out_selfie_url',
        'schedule_time',
        'attendance_state',
        'location',
        'late_minutes',
        'undertime_minutes',
        'total_hours',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id', 'employee_id');
    }

    public function schedule()
    {
        return $this->belongsTo(Schedule::class, 'schedule_id', 'schedule_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by', 'user_id');
    }

    public function overtimeRequest()
    {
        return $this->hasOne(OvertimeRequest::class, 'attendance_id', 'attendance_id');
    }

    public function getIdAttribute()
    {
        return $this->attendance_id;
    }

    public function getEmployeeNameAttribute(): string
    {
        return $this->employee?->full_name ?? 'N/A';
    }

    public function getEmployeeCodeAttribute(): ?string
    {
        return $this->employee?->employee_code;
    }

    public function getDepartmentAttribute(): ?string
    {
        return $this->employee?->department?->name;
    }

    public function getVerificationStatusAttribute(): string
    {
        return match ($this->approval_status) {
            'approved' => 'verified',
            'rejected' => 'rejected',
            default => 'pending',
        };
    }

    public function getFormattedDateAttribute(): ?string
    {
        return $this->attendance_date?->format('M d, Y');
    }

    public function getFormattedTimeInAttribute(): ?string
    {
        return $this->time_in?->format('h:i A');
    }

    public function getFormattedTimeOutAttribute(): ?string
    {
        return $this->time_out?->format('h:i A');
    }

    public function getTimestampAttribute(): ?string
    {
        return ($this->time_in ?? $this->time_out)?->toIso8601String();
    }

    public function getTypeAttribute(): string
    {
        return $this->time_in ? 'IN' : 'OUT';
    }

    public function getSelfieUrlAttribute(): ?string
    {
        return $this->normalizeStorageUrl($this->time_in_photo ?: $this->time_out_photo);
    }

    public function getTimeInSelfieUrlAttribute(): ?string
    {
        return $this->normalizeStorageUrl($this->time_in_photo);
    }

    public function getTimeOutSelfieUrlAttribute(): ?string
    {
        return $this->normalizeStorageUrl($this->time_out_photo);
    }

    public function getScheduleTimeAttribute(): string
    {
        if (! $this->schedule) {
            return 'Unscheduled';
        }

        return trim(($this->schedule->start_time ?? '') . ' - ' . ($this->schedule->end_time ?? '')) ?: 'Scheduled';
    }

    public function getAttendanceStateAttribute(): string
    {
        if (! $this->time_in) {
            return 'No time in';
        }

        if (! $this->time_out) {
            return 'No time out';
        }

        return 'Complete';
    }

    public function getLocationAttribute(): ?array
    {
        $lat = $this->time_in_latitude ?? $this->time_out_latitude;
        $lng = $this->time_in_longitude ?? $this->time_out_longitude;

        if ($lat === null || $lng === null) {
            return null;
        }

        return [
            'lat' => (float) $lat,
            'lng' => (float) $lng,
        ];
    }

    public function getLateMinutesAttribute(): int
    {
        if (! $this->time_in || ! $this->schedule?->start_time || ! $this->attendance_date) {
            return $this->status === 'late' ? 1 : 0;
        }

        $scheduledStart = Carbon::parse($this->attendance_date->format('Y-m-d') . ' ' . $this->schedule->start_time);

        return max(0, $scheduledStart->diffInMinutes($this->time_in, false));
    }

    public function getUndertimeMinutesAttribute(): int
    {
        return max(0, (int) round(((float) $this->undertime_hours) * 60));
    }

    public function getTotalHoursAttribute(): float
    {
        return round(((float) $this->regular_hours) + ((float) $this->overtime_hours), 2);
    }

    private function normalizeStorageUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://') || str_starts_with($path, '/')) {
            return $path;
        }

        return Storage::url($path);
    }
}
