<?php

namespace App\Services;

use App\Models\AttendanceLog;
use App\Models\Schedule;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class AttendanceService
{
    public function timeIn($employee, array $data): AttendanceLog
    {
        return DB::transaction(function () use ($employee, $data) {
            $timestamp = $this->attendanceTimestamp($data);
            $date = $timestamp->toDateString();

            $open = AttendanceLog::where('employee_id', $employee->employee_id)
                ->whereDate('attendance_date', $date)
                ->whereNotNull('time_in')
                ->whereNull('time_out')
                ->first();

            if ($open) {
                throw new RuntimeException('Employee already has an open attendance record.');
            }

            $schedule = Schedule::where('employee_id', $employee->employee_id)
                ->whereDate('work_date', $date)
                ->first();

            $status = $this->initialStatus($timestamp, $schedule);

            $log = AttendanceLog::create([
                'employee_id' => $employee->employee_id,
                'schedule_id' => $schedule?->schedule_id,
                'attendance_date' => $date,
                'time_in' => $timestamp,
                'time_in_latitude' => $data['latitude'] ?? null,
                'time_in_longitude' => $data['longitude'] ?? null,
                'time_in_photo' => $this->storeSelfie($data['selfie'] ?? null, $employee->employee_id, 'in'),
                'device_info' => $data['device_info'] ?? null,
                'ip_address' => request()?->ip(),
                'status' => $status,
                'approval_status' => 'pending',
            ]);

            return $log->fresh(['employee.person', 'employee.department', 'employee.position.salaryGrade', 'schedule']);
        });
    }

    public function timeOut($employee, array $data): AttendanceLog
    {
        return DB::transaction(function () use ($employee, $data) {
            $timestamp = $this->attendanceTimestamp($data);

            $log = AttendanceLog::where('employee_id', $employee->employee_id)
                ->whereNotNull('time_in')
                ->whereNull('time_out')
                ->latest('attendance_id')
                ->firstOrFail();

            $log->update([
                'time_out' => $timestamp,
                'time_out_latitude' => $data['latitude'] ?? null,
                'time_out_longitude' => $data['longitude'] ?? null,
                'time_out_photo' => $this->storeSelfie($data['selfie'] ?? null, $employee->employee_id, 'out'),
            ]);

            return $this->recalculate($log->fresh(['schedule']));
        });
    }

    public function recalculate(AttendanceLog $log): AttendanceLog
    {
        $hours = $this->computeHours($log);
        $overtimeRequest = $log->overtimeRequest()->latest('overtime_request_id')->first();
        $overtimeHours = $hours['overtime'];
        $overtimeApproved = false;

        // Preserve an administrator's overtime decision when hours are recalculated.
        if ($overtimeRequest?->status === 'rejected') {
            $overtimeHours = 0;
        } elseif ($overtimeRequest?->status === 'approved') {
            $overtimeHours = round(min($overtimeHours, (float) $overtimeRequest->hours), 2);
            $overtimeApproved = $overtimeHours > 0;
        } elseif ((bool) $log->overtime_approved) {
            $overtimeHours = round(min($overtimeHours, (float) $log->overtime_hours), 2);
            $overtimeApproved = $overtimeHours > 0;
        }

        $updates = [
            'regular_hours' => $hours['regular'],
            'overtime_hours' => $overtimeHours,
            'undertime_hours' => $hours['undertime'],
            'overtime_approved' => $overtimeApproved,
        ];

        if ($log->time_in && $log->schedule) {
            $updates['status'] = $this->initialStatus($log->time_in, $log->schedule);
        }

        $log->update($updates);

        return $log->fresh([
            'employee.person',
            'employee.department',
            'employee.position.salaryGrade',
            'schedule',
            'overtimeRequest',
        ]);
    }

    public function computeHours(AttendanceLog $log): array
    {
        if (! $log->time_in || ! $log->time_out) {
            return ['regular' => 0, 'overtime' => 0, 'undertime' => 0];
        }

        $timeIn = $log->time_in instanceof Carbon ? $log->time_in->copy() : Carbon::parse($log->time_in);
        $timeOut = $log->time_out instanceof Carbon ? $log->time_out->copy() : Carbon::parse($log->time_out);

        if ($timeOut->lessThanOrEqualTo($timeIn)) {
            $timeOut->addDay();
        }

        $workedMinutes = max(0, $timeIn->diffInMinutes($timeOut));
        $breakMinutes = max(0, (int) round((float) ($log->schedule?->break_minutes ?? 0)));
        $workedHours = max(0, ($workedMinutes - $breakMinutes) / 60);
        $scheduledHours = $this->scheduledHours($log->schedule) ?: 8;

        // Overtime begins only after more than nine elapsed hours. For schedules
        // longer than eight paid hours, respect the scheduled hours plus break.
        $overtimeThresholdMinutes = max(9 * 60, (int) round(($scheduledHours * 60) + $breakMinutes));
        $overtimeHours = $workedMinutes > $overtimeThresholdMinutes
            ? max(0, $workedHours - $scheduledHours)
            : 0;

        return [
            'regular' => round(min($scheduledHours, $workedHours), 2),
            'overtime' => round($overtimeHours, 2),
            'undertime' => round(max(0, $scheduledHours - $workedHours), 2),
        ];
    }

    private function attendanceTimestamp(array $data): Carbon
    {
        $candidate = $data['captured_at'] ?? $data['timestamp'] ?? null;

        if ($candidate) {
            return Carbon::parse($candidate);
        }

        return now();
    }

    private function initialStatus(Carbon $timestamp, ?Schedule $schedule): string
    {
        if (! $schedule) {
            return 'unscheduled';
        }

        if (! $schedule->start_time || ! $schedule->work_date) {
            return 'present';
        }

        $scheduledStart = Carbon::parse($schedule->work_date->format('Y-m-d') . ' ' . $schedule->start_time);

        return $timestamp->greaterThan($scheduledStart) ? 'late' : 'present';
    }

    private function scheduledHours(?Schedule $schedule): float
    {
        if (! $schedule) {
            return 8;
        }

        return (float) ($schedule->duration_hours ?? 8);
    }

    private function storeSelfie(?string $selfie, int $employeeId, string $direction): ?string
    {
        if (! $selfie) {
            return null;
        }

        if (str_starts_with($selfie, 'http://') || str_starts_with($selfie, 'https://') || str_starts_with($selfie, '/storage/')) {
            return $selfie;
        }

        if (! str_contains($selfie, 'base64,')) {
            return $selfie;
        }

        [$meta, $payload] = explode('base64,', $selfie, 2);
        $binary = base64_decode($payload, true);

        if ($binary === false) {
            return null;
        }

        $extension = str_contains($meta, 'png') ? 'png' : 'jpg';
        $directory = 'attendance-selfies/' . now()->format('Y-m-d');
        $path = $directory . '/employee-' . $employeeId . '-' . $direction . '-' . Str::uuid() . '.' . $extension;

        Storage::disk('public')->put($path, $binary);

        return $path;
    }
}
