<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\AttendanceRequest;
use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\OvertimeRequest;
use App\Models\Payroll;
use App\Models\Schedule;
use App\Services\AttendanceService;
use App\Services\PayrollService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        $query = AttendanceLog::with([
            'employee.person',
            'employee.department',
            'employee.position.salaryGrade',
            'schedule',
            'approver',
        ]);
        $this->excludeAnalyticsOnly($query, $request);

        if ($request->filled('employee_id')) {
            $employeeIdentifier = $request->input('employee_id');
            if (is_numeric($employeeIdentifier)) {
                $query->where('employee_id', $employeeIdentifier);
            } else {
                $query->whereHas('employee', function ($employeeQuery) use ($employeeIdentifier) {
                    $employeeQuery->where('employee_code', 'like', "%{$employeeIdentifier}%")
                        ->orWhereHas('person', function ($personQuery) use ($employeeIdentifier) {
                            $personQuery->where('first_name', 'like', "%{$employeeIdentifier}%")
                                ->orWhere('last_name', 'like', "%{$employeeIdentifier}%");
                        });
                });
            }
        }

        if ($request->filled('department_id')) {
            $query->whereHas('employee', fn ($employeeQuery) => $employeeQuery->where('department_id', $request->input('department_id')));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('approval_status')) {
            $query->where('approval_status', $this->normalizeApprovalStatus($request->input('approval_status')));
        }

        if ($request->filled('verification_status')) {
            $query->where('approval_status', $this->normalizeApprovalStatus($request->input('verification_status')));
        }

        if ($request->filled('date')) {
            $query->whereDate('attendance_date', $request->input('date'));
        }

        $from = $request->input('from', $request->input('start_date'));
        $to = $request->input('to', $request->input('end_date'));

        if ($from) {
            $query->whereDate('attendance_date', '>=', $from);
        }

        if ($to) {
            $query->whereDate('attendance_date', '<=', $to);
        }

        if ($request->boolean('today')) {
            $query->whereDate('attendance_date', today());
        }

        $attendance = $query->latest('attendance_id')->paginate($request->integer('per_page', 20));
        $attendanceService = app(AttendanceService::class);
        $attendance->setCollection($attendance->getCollection()->map(function (AttendanceLog $row) use ($attendanceService) {
            return $row->time_in && $row->time_out ? $attendanceService->recalculate($row) : $row;
        }));

        return $this->ok($attendance);
    }

    public function today(Request $request)
    {
        $request->merge(['today' => true]);

        return $this->index($request);
    }

    public function needsApproval(Request $request)
    {
        $request->merge(['approval_status' => 'pending']);

        return $this->index($request);
    }

    public function employee(Request $request, Employee $employee)
    {
        $request->merge(['employee_id' => $employee->employee_id]);

        return $this->index($request);
    }

    public function summary(Request $request)
    {
        if ($request->filled('employee_id')) {
            return $this->employeeSummary($request);
        }

        $monthStart = $request->input('start_date', now()->startOfMonth()->toDateString());
        $monthEnd = $request->input('end_date', now()->endOfMonth()->toDateString());

        $todayQuery = AttendanceLog::query();
        $periodQuery = AttendanceLog::query();
        $this->excludeAnalyticsOnly($todayQuery, $request);
        $this->excludeAnalyticsOnly($periodQuery, $request);
        $todayQuery->whereDate('attendance_date', today());
        $periodQuery->whereBetween('attendance_date', [$monthStart, $monthEnd]);
        $pendingQuery = (clone $periodQuery)->where('approval_status', 'pending');
        $approvedCount = (clone $periodQuery)->where('approval_status', 'approved')->count();
        $rejectedCount = (clone $periodQuery)->where('approval_status', 'rejected')->count();
        $pendingCount = (clone $pendingQuery)->count();
        $decisionBase = $approvedCount + $rejectedCount + $pendingCount;

        return $this->ok([
            // Existing dashboard-compatible fields.
            'total' => (clone $todayQuery)->count(),
            'present' => (clone $todayQuery)->whereIn('status', ['present', 'late'])->count(),
            'late' => (clone $todayQuery)->where('status', 'late')->count(),
            'unscheduled' => (clone $todayQuery)->where('status', 'unscheduled')->count(),
            'pending' => (clone $todayQuery)->where('approval_status', 'pending')->count(),

            // Attendance status panel fields used by Staff_Attendance.jsx.
            'pending_approval_count' => $pendingCount,
            'approved_this_month' => $approvedCount,
            'declined_this_month' => $rejectedCount,
            'total_hours_pending' => round((float) (clone $pendingQuery)->sum('regular_hours') + (float) (clone $pendingQuery)->sum('overtime_hours'), 2),
            'employees_with_pending' => (clone $pendingQuery)->distinct('employee_id')->count('employee_id'),
            'approval_rate' => $decisionBase > 0 ? round(($approvedCount / $decisionBase) * 100, 1) : 0,
        ]);
    }

    public function statistics(Request $request)
    {
        $query = AttendanceLog::query();
        $this->excludeAnalyticsOnly($query, $request);

        if ($request->filled('year')) {
            $query->whereYear('attendance_date', $request->integer('year'));
        }

        if ($request->filled('month')) {
            $query->whereMonth('attendance_date', $request->integer('month'));
        }

        return $this->ok([
            'total' => (clone $query)->count(),
            'approved' => (clone $query)->where('approval_status', 'approved')->count(),
            'pending' => (clone $query)->where('approval_status', 'pending')->count(),
            'rejected' => (clone $query)->where('approval_status', 'rejected')->count(),
            'overtime_hours' => round((float) (clone $query)->sum('overtime_hours'), 2),
            'undertime_hours' => round((float) (clone $query)->sum('undertime_hours'), 2),
        ]);
    }

    public function timeIn(AttendanceRequest $request, AttendanceService $service)
    {
        return $this->ok($service->timeIn($this->resolveAttendanceEmployee($request), $request->validated()), 'Timed in');
    }

    public function timeOut(AttendanceRequest $request, AttendanceService $service)
    {
        return $this->ok($service->timeOut($this->resolveAttendanceEmployee($request), $request->validated()), 'Timed out');
    }

    public function updateTimes(Request $request, AttendanceLog $attendance, AttendanceService $attendanceService, PayrollService $payrollService)
    {
        $data = $request->validate([
            'time_in' => 'nullable|date',
            'time_out' => 'nullable|date',
            'approval_status' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if (! $request->exists('time_in') && ! $request->exists('time_out')) {
            throw ValidationException::withMessages([
                'attendance' => 'Provide a time-in, time-out, or both to update the attendance record.',
            ]);
        }

        $updates = [];
        if ($request->exists('time_in')) {
            $updates['time_in'] = $request->filled('time_in') ? Carbon::parse($request->input('time_in')) : null;
        }
        if ($request->exists('time_out')) {
            $updates['time_out'] = $request->filled('time_out') ? Carbon::parse($request->input('time_out')) : null;
        }

        $effectiveTimeIn = array_key_exists('time_in', $updates) ? $updates['time_in'] : $attendance->time_in;
        if ($effectiveTimeIn) {
            $updates['attendance_date'] = Carbon::parse($effectiveTimeIn)->toDateString();
        }

        if (array_key_exists('approval_status', $data)) {
            $status = $this->normalizeApprovalStatus($data['approval_status']);
            $updates['approval_status'] = $status;
            $updates['approved_by'] = in_array($status, ['approved', 'rejected'], true) ? auth()->id() : null;
            $updates['approved_at'] = in_array($status, ['approved', 'rejected'], true) ? now() : null;
        }
        if (array_key_exists('notes', $data)) {
            $updates['approval_notes'] = $data['notes'];
        }

        DB::transaction(function () use ($attendance, $updates) {
            $attendance->overtimeRequest()->delete();
            $attendance->fill(array_merge($updates, [
                'overtime_approved' => false,
            ]))->save();
        });

        $attendance = $attendance->fresh(['schedule', 'overtimeRequest']);
        if ($attendance->time_in && $attendance->time_out) {
            $attendance = $attendanceService->recalculate($attendance);
        } else {
            $attendance->update([
                'regular_hours' => 0,
                'overtime_hours' => 0,
                'undertime_hours' => 0,
                'overtime_approved' => false,
            ]);
            $attendance = $attendance->fresh(['schedule', 'overtimeRequest']);
        }

        $payrollSync = ['synced' => false, 'message' => null];
        if ($attendance->time_in && $attendance->time_out && $this->normalizeApprovalStatus($attendance->approval_status) === 'approved') {
            [$cutoffStart, $cutoffEnd] = $this->cutoffForDate($attendance->attendance_date);
            try {
                $payroll = $payrollService->generate($attendance->employee_id, $cutoffStart, $cutoffEnd, 'Automatically synchronized after attendance correction.');
                $payrollSync = ['synced' => true, 'payroll_id' => $payroll->payroll_id, 'message' => 'Payroll synchronized.'];
            } catch (ValidationException $exception) {
                $payrollSync['message'] = collect($exception->errors())->flatten()->first() ?: $exception->getMessage();
            } catch (\Throwable $exception) {
                report($exception);
                $payrollSync['message'] = 'Attendance was saved, but payroll synchronization needs review.';
            }
        }

        $attendance->load(['employee.person', 'employee.department', 'employee.position.salaryGrade', 'schedule', 'overtimeRequest']);

        return $this->ok([
            'attendance' => $this->attendanceRecordPayload($attendance),
            'payroll_sync' => $payrollSync,
        ], 'Attendance times updated');
    }

    public function updateStatus(Request $request, AttendanceLog $attendance)
    {
        $request->validate([
            'verification_status' => 'nullable|string',
            'approval_status' => 'nullable|string',
            'verification_notes' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        $status = $this->normalizeApprovalStatus(
            $request->input('verification_status', $request->input('approval_status', 'pending'))
        );

        if (! in_array($status, ['pending', 'approved', 'rejected'], true)) {
            throw ValidationException::withMessages([
                'approval_status' => 'Attendance approval status must be pending, approved, rejected, or verified.',
            ]);
        }

        $isReviewed = in_array($status, ['approved', 'rejected'], true);

        $attendance->update([
            'approval_status' => $status,
            'approval_notes' => $request->input('verification_notes', $request->input('notes')),
            'approved_by' => $isReviewed ? auth()->id() : null,
            'approved_at' => $isReviewed ? now() : null,
        ]);

        return $this->ok($attendance->fresh(['employee.person', 'employee.department', 'schedule']), 'Attendance updated');
    }

    public function approve(Request $request, AttendanceLog $attendance)
    {
        $validated = $request->validate([
            'notes' => 'nullable|string',
            'overtime_confirmed' => 'nullable|boolean',
            'remove_overtime' => 'nullable|boolean',
            'approved_overtime_hours' => 'nullable|numeric|min:0',
            'overtime_reason' => 'nullable|string',
        ]);

        if (
            (float) $attendance->overtime_hours > 0
            && ! $request->boolean('remove_overtime')
            && ! $request->boolean('overtime_confirmed')
            && ! array_key_exists('approved_overtime_hours', $validated)
            && ! $attendance->overtimeRequest()->whereIn('status', ['approved', 'rejected'])->exists()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'This attendance has overtime. Please approve or decline the overtime before saving it for payroll.',
                'requires_overtime_confirmation' => true,
                'attendance_id' => $attendance->attendance_id,
                'overtime_hours' => (float) $attendance->overtime_hours,
            ], 409);
        }

        $attendanceUpdates = [
            'approval_status' => 'approved',
            'approval_notes' => $validated['notes'] ?? null,
            'approved_by' => auth()->id(),
            'approved_at' => now(),
        ];

        if ($request->boolean('remove_overtime')) {
            $attendanceUpdates['overtime_hours'] = 0;
            $attendanceUpdates['overtime_approved'] = false;

            OvertimeRequest::updateOrCreate(
                ['attendance_id' => $attendance->attendance_id],
                [
                    'employee_id' => $attendance->employee_id,
                    'hours' => 0,
                    'reason' => $validated['overtime_reason'] ?? 'Overtime removed during attendance approval.',
                    'status' => 'rejected',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                ]
            );
        } elseif ($request->boolean('overtime_confirmed') || array_key_exists('approved_overtime_hours', $validated)) {
            $approvedHours = array_key_exists('approved_overtime_hours', $validated)
                ? min((float) $validated['approved_overtime_hours'], (float) $attendance->overtime_hours)
                : (float) $attendance->overtime_hours;

            $attendanceUpdates['overtime_hours'] = $approvedHours;
            $attendanceUpdates['overtime_approved'] = $approvedHours > 0;

            OvertimeRequest::updateOrCreate(
                ['attendance_id' => $attendance->attendance_id],
                [
                    'employee_id' => $attendance->employee_id,
                    'hours' => $approvedHours,
                    'reason' => $validated['overtime_reason'] ?? null,
                    'status' => $approvedHours > 0 ? 'approved' : 'rejected',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                ]
            );
        }

        $attendance->update($attendanceUpdates);

        return $this->ok($attendance->fresh(['employee.person', 'employee.department', 'schedule']), 'Attendance approved');
    }

    public function unverify(AttendanceLog $attendance)
    {
        $attendance->update([
            'approval_status' => 'pending',
            'approved_by' => null,
            'approved_at' => null,
        ]);

        return $this->ok($attendance->fresh(['employee.person', 'employee.department', 'schedule']), 'Attendance returned to pending');
    }

    public function approveUnscheduled(Request $request, AttendanceLog $attendance)
    {
        $validated = $request->validate([
            'admin_notes' => 'nullable|string',
        ]);

        $attendance->update([
            'approval_status' => 'approved',
            'approval_notes' => $validated['admin_notes'] ?? null,
            'approved_by' => auth()->id(),
            'approved_at' => now(),
        ]);

        return $this->ok($attendance->fresh(['employee.person', 'employee.department', 'schedule']), 'Unscheduled attendance approved');
    }

    public function approveOvertime(Request $request, AttendanceLog $attendance)
    {
        $validated = $request->validate([
            'approved_overtime_hours' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $approvedHours = min(
            (float) ($validated['approved_overtime_hours'] ?? $attendance->overtime_hours),
            (float) $attendance->overtime_hours
        );

        $attendance->update([
            'overtime_hours' => $approvedHours,
            'overtime_approved' => $approvedHours > 0,
        ]);

        OvertimeRequest::updateOrCreate(
            ['attendance_id' => $attendance->attendance_id],
            [
                'employee_id' => $attendance->employee_id,
                'hours' => $approvedHours,
                'reason' => $validated['notes'] ?? null,
                'status' => $approvedHours > 0 ? 'approved' : 'rejected',
                'approved_by' => auth()->id(),
                'approved_at' => now(),
            ]
        );

        return $this->ok($attendance->fresh(), 'Overtime approved');
    }

    public function rejectOvertime(Request $request, AttendanceLog $attendance)
    {
        $validated = $request->validate([
            'reason' => 'nullable|string',
        ]);

        $originalOvertimeHours = (float) $attendance->overtime_hours;

        $attendance->update([
            'overtime_hours' => 0,
            'overtime_approved' => false,
        ]);

        OvertimeRequest::updateOrCreate(
            ['attendance_id' => $attendance->attendance_id],
            [
                'employee_id' => $attendance->employee_id,
                'hours' => $originalOvertimeHours,
                'reason' => $validated['reason'] ?? null,
                'status' => 'rejected',
                'approved_by' => auth()->id(),
                'approved_at' => now(),
            ]
        );

        return $this->ok($attendance->fresh(['overtimeRequest']), 'Overtime rejected');
    }

    public function bulkOvertimeDecision(Request $request, AttendanceService $attendanceService)
    {
        $data = $request->validate([
            'attendance_ids' => 'required|array|min:1',
            'attendance_ids.*' => 'integer|distinct|exists:attendance_logs,attendance_id',
            'action' => 'required|in:approve,reject',
            'reason' => 'nullable|string',
        ]);

        $updated = collect();
        $skipped = collect();

        DB::transaction(function () use ($data, $attendanceService, $updated, $skipped) {
            $records = AttendanceLog::with(['schedule', 'overtimeRequest'])
                ->whereIn('attendance_id', $data['attendance_ids'])
                ->lockForUpdate()
                ->get();

            foreach ($records as $attendance) {
                if (! $attendance->time_in || ! $attendance->time_out) {
                    $skipped->push(['attendance_id' => $attendance->attendance_id, 'reason' => 'Missing time-in or time-out.']);
                    continue;
                }

                $attendance = $attendanceService->recalculate($attendance);
                $computedHours = (float) $attendance->overtime_hours;
                if ($computedHours <= 0) {
                    $skipped->push(['attendance_id' => $attendance->attendance_id, 'reason' => 'No overtime beyond nine hours.']);
                    continue;
                }

                $isApproved = $data['action'] === 'approve';
                $attendance->update([
                    'overtime_hours' => $isApproved ? $computedHours : 0,
                    'overtime_approved' => $isApproved,
                ]);

                OvertimeRequest::updateOrCreate(
                    ['attendance_id' => $attendance->attendance_id],
                    [
                        'employee_id' => $attendance->employee_id,
                        'hours' => $computedHours,
                        'reason' => $data['reason'] ?? ($isApproved ? 'Bulk approved by administrator.' : 'Bulk declined by administrator.'),
                        'status' => $isApproved ? 'approved' : 'rejected',
                        'approved_by' => auth()->id(),
                        'approved_at' => now(),
                    ]
                );

                $updated->push($attendance->fresh(['schedule', 'overtimeRequest']));
            }
        });

        return $this->ok([
            'updated_count' => $updated->count(),
            'skipped_count' => $skipped->count(),
            'records' => $updated->map(fn (AttendanceLog $row) => $this->attendanceRecordPayload($row))->values(),
            'skipped' => $skipped->values(),
        ], $data['action'] === 'approve' ? 'Selected overtime approved' : 'Selected overtime declined');
    }

    public function employeeOverview(Request $request, AttendanceService $attendanceService)
    {
        [$start, $end] = $this->attendancePeriod($request);

        $query = Employee::with(['person', 'department', 'position.salaryGrade'])
            ->whereHas('attendanceLogs', function ($attendanceQuery) use ($start, $end) {
                $attendanceQuery->whereBetween('attendance_date', [$start, $end]);
            });

        if ($request->filled('department_id') && $request->input('department_id') !== 'all') {
            $query->where('department_id', $request->input('department_id'));
        }

        if ($request->filled('employee_id') && $request->input('employee_id') !== 'all') {
            $identifier = (string) $request->input('employee_id');
            $query->where(function ($employeeQuery) use ($identifier) {
                if (is_numeric($identifier)) {
                    $employeeQuery->orWhere('employee_id', (int) $identifier);
                }

                $employeeQuery->orWhere('employee_code', 'like', "%{$identifier}%")
                    ->orWhereHas('person', function ($personQuery) use ($identifier) {
                        $personQuery->where('first_name', 'like', "%{$identifier}%")
                            ->orWhere('last_name', 'like', "%{$identifier}%")
                            ->orWhere('email', 'like', "%{$identifier}%");
                    });
            });
        }

        $employees = $query
            ->orderBy('employee_id')
            ->get()
            ->map(function (Employee $employee) use ($start, $end, $attendanceService) {
                $records = $this->attendanceRowsForEmployee($employee->employee_id, $start, $end)
                    ->map(function (AttendanceLog $attendance) use ($attendanceService) {
                        if ($attendance->time_in && $attendance->time_out) {
                            $attendance = $attendanceService->recalculate($attendance);
                        }
                        return $this->attendanceRecordPayload($attendance);
                    })
                    ->values();
                $summary = $this->summaryFromRecords($records);
                $payroll = Payroll::withTrashed()
                    ->where('employee_id', $employee->employee_id)
                    ->whereDate('cutoff_start', $start)
                    ->whereDate('cutoff_end', $end)
                    ->first();
                $allApproved = $records->isNotEmpty() && $records->every(
                    fn (array $row) => $this->normalizeApprovalStatus($row['approval_status'] ?? null) === 'approved'
                        && ($row['attendance_state'] ?? null) === 'Complete'
                        && ($row['overtime_status'] ?? null) !== 'pending'
                );

                return array_merge($summary, [
                    'employee_id' => $employee->employee_id,
                    'employee_code' => $employee->employee_code,
                    'employee_name' => $employee->full_name ?: 'N/A',
                    'position' => $employee->position?->title ?? $employee->position?->name ?? 'N/A',
                    'department' => $employee->department?->name ?? 'N/A',
                    'generated' => false,
                    'all_approved' => $allApproved,
                    'saved_to_payroll' => (bool) $payroll,
                    'payroll_status' => $payroll?->status,
                    'payroll_archived' => (bool) $payroll?->trashed(),
                ]);
            })
            ->values();

        return $this->ok([
            'period_start' => $start,
            'period_end' => $end,
            'can_generate' => $this->canGenerateForPeriod($start, $end),
            'employees' => $employees,
        ]);
    }

    public function employeeRecords(Request $request, AttendanceService $attendanceService)
    {
        [$start, $end] = $this->attendancePeriod($request);
        $employee = $this->findAttendanceEmployee((string) $request->validate([
            'employee_id' => 'required',
        ])['employee_id']);

        $records = $this->attendanceRowsForEmployee($employee->employee_id, $start, $end)
            ->map(function (AttendanceLog $attendance) use ($attendanceService) {
                if ($attendance->time_in && $attendance->time_out) {
                    $attendance = $attendanceService->recalculate($attendance);
                }
                return $this->attendanceRecordPayload($attendance);
            })
            ->values();

        return $this->ok([
            'employee' => $this->employeePayload($employee),
            'period_start' => $start,
            'period_end' => $end,
            'records' => $records,
            'summary' => $this->summaryFromRecords($records),
        ]);
    }

    public function generateSummary(Request $request, AttendanceService $service)
    {
        [$start, $end] = $this->attendancePeriod($request);
        $employee = $this->findAttendanceEmployee((string) $request->validate([
            'employee_id' => 'required',
        ])['employee_id']);

        $records = $this->attendanceRowsForEmployee($employee->employee_id, $start, $end)
            ->map(function (AttendanceLog $attendance) use ($service) {
                if ($attendance->time_in && $attendance->time_out) {
                    $attendance = $service->recalculate($attendance);
                    $attendance->load(['employee.person', 'employee.department', 'employee.position.salaryGrade', 'schedule', 'overtimeRequest']);
                }

                return $this->attendanceRecordPayload($attendance);
            })
            ->values();

        return $this->ok([
            'employee' => $this->employeePayload($employee),
            'period_start' => $start,
            'period_end' => $end,
            'can_generate' => $this->canGenerateForPeriod($start, $end),
            'records' => $records,
            'summary' => $this->summaryFromRecords($records),
            'unresolved_overtime_count' => $records->where('overtime_status', 'pending')->count(),
            'missing_time_count' => $records->filter(fn ($row) => $row['attendance_state'] !== 'Complete')->count(),
        ], 'Attendance summary generated');
    }

    public function saveSummaryToPayroll(Request $request, PayrollService $payrollService, AttendanceService $attendanceService)
    {
        [$start, $end] = $this->attendancePeriod($request);
        $employee = $this->findAttendanceEmployee((string) $request->validate([
            'employee_id' => 'required',
            'notes' => 'nullable|string',
        ])['employee_id']);

        $payroll = $this->generatePayrollFromAttendance(
            $employee,
            $start,
            $end,
            $request->input('notes'),
            $payrollService,
            $attendanceService
        );

        return $this->ok($payroll, 'Attendance summary saved to payroll');
    }

    public function saveAllSummariesToPayroll(Request $request, PayrollService $payrollService, AttendanceService $attendanceService)
    {
        [$start, $end] = $this->attendancePeriod($request);
        $request->validate(['notes' => 'nullable|string']);

        if (! $this->isPayrollCutoff($start, $end)) {
            throw ValidationException::withMessages([
                'period' => 'Payroll saving is only allowed for 1-15 or 16-end of month cutoff periods.',
            ]);
        }

        $employees = Employee::with(['person', 'department', 'position.salaryGrade'])
            ->whereHas('attendanceLogs', fn ($query) => $query->whereBetween('attendance_date', [$start, $end]))
            ->orderBy('employee_id')
            ->get();

        $processed = collect();
        $skipped = collect();

        foreach ($employees as $employee) {
            try {
                $payroll = $this->generatePayrollFromAttendance(
                    $employee,
                    $start,
                    $end,
                    $request->input('notes', 'Automatically saved from Attendance Employee Overview.'),
                    $payrollService,
                    $attendanceService
                );
                $processed->push([
                    'employee_id' => $employee->employee_id,
                    'employee_name' => $employee->full_name,
                    'payroll_id' => $payroll->payroll_id,
                    'status' => $payroll->status,
                ]);
            } catch (ValidationException $exception) {
                $skipped->push([
                    'employee_id' => $employee->employee_id,
                    'employee_name' => $employee->full_name,
                    'reason' => collect($exception->errors())->flatten()->first() ?: $exception->getMessage(),
                ]);
            } catch (\Throwable $exception) {
                report($exception);
                $skipped->push([
                    'employee_id' => $employee->employee_id,
                    'employee_name' => $employee->full_name,
                    'reason' => 'Payroll could not be generated for this employee.',
                ]);
            }
        }

        return $this->ok([
            'period_start' => $start,
            'period_end' => $end,
            'processed_count' => $processed->count(),
            'skipped_count' => $skipped->count(),
            'processed' => $processed->values(),
            'skipped' => $skipped->values(),
        ], $processed->isNotEmpty()
            ? "{$processed->count()} employee payroll record(s) synchronized."
            : 'No payroll records were ready to synchronize.');
    }

    public function mobileLogin(Request $request)
    {
        $data = $request->validate([
            'employee_id' => 'required|string',
        ]);

        $employee = $this->findAttendanceEmployee($data['employee_id']);

        return $this->ok(['employee' => $employee], 'Attendance employee selected');
    }

    /**
 * Check for employees with missing time-outs
 */
public function checkMissingTimeouts(): JsonResponse
{
    $yesterday = now()->subDay()->toDateString();
    
    $missingTimeouts = AttendanceLog::whereDate('attendance_date', $yesterday)
        ->whereNotNull('time_in')
        ->whereNull('time_out')
        ->with('employee')
        ->get();
    
    $notificationService = app(\App\Services\NotificationService::class);
    
    foreach ($missingTimeouts as $attendance) {
        if ($attendance->employee) {
            $notificationService->missingTimeoutAlert($attendance->employee, $attendance);
        }
    }
    
    return $this->ok(['notified' => $missingTimeouts->count()]);
}


    public function mobileLogout()
    {
        return $this->ok(null, 'Attendance session cleared');
    }


    private function employeeSummary(Request $request)
    {
        $employee = $this->findAttendanceEmployee($request->input('employee_id'));
        $today = today()->toDateString();
        $monthStart = $request->input('start_date', now()->startOfMonth()->toDateString());
        $monthEnd = $request->input('end_date', now()->endOfMonth()->toDateString());

        $todaySchedule = Schedule::with(['shiftTypeDefinition'])
            ->where('employee_id', $employee->employee_id)
            ->whereDate('work_date', $today)
            ->first();

        $todayAttendance = AttendanceLog::with(['schedule'])
            ->where('employee_id', $employee->employee_id)
            ->whereDate('attendance_date', $today)
            ->latest('attendance_id')
            ->first();

        $period = AttendanceLog::where('employee_id', $employee->employee_id)
            ->whereBetween('attendance_date', [$monthStart, $monthEnd]);

        $approvedPeriod = (clone $period)->where('approval_status', 'approved');

        $todayStatus = 'not_started';
        if ($todayAttendance?->time_in && ! $todayAttendance?->time_out) {
            $todayStatus = 'timed_in';
        } elseif ($todayAttendance?->time_in && $todayAttendance?->time_out) {
            $todayStatus = 'completed';
        }

        return $this->ok([
            'employee' => $employee,
            'today_status' => $todayStatus,
            'today_schedule' => $todaySchedule,
            'today_attendance' => $todayAttendance,
            'present_days' => (clone $approvedPeriod)->whereIn('status', ['present', 'late', 'unscheduled'])->count(),
            'pending_approval_count' => (clone $period)->where('approval_status', 'pending')->count(),
            'approved_this_month' => (clone $period)->where('approval_status', 'approved')->count(),
            'current_month' => [
                'start_date' => $monthStart,
                'end_date' => $monthEnd,
                'present_days' => (clone $approvedPeriod)->whereIn('status', ['present', 'late', 'unscheduled'])->count(),
                'regular_hours' => round((float) (clone $approvedPeriod)->sum('regular_hours'), 2),
                'overtime_hours' => round((float) (clone $approvedPeriod)->where('overtime_approved', true)->sum('overtime_hours'), 2),
                'total_hours' => round(
                    (float) (clone $approvedPeriod)->sum('regular_hours')
                    + (float) (clone $approvedPeriod)->where('overtime_approved', true)->sum('overtime_hours'),
                    2
                ),
                'late_undertime_hours' => round((float) (clone $approvedPeriod)->sum('undertime_hours'), 2),
            ],
            'last_30_days' => AttendanceLog::with(['schedule'])
                ->where('employee_id', $employee->employee_id)
                ->whereDate('attendance_date', '>=', now()->subDays(30)->toDateString())
                ->orderByDesc('attendance_date')
                ->get(),
        ]);
    }

    private function resolveAttendanceEmployee(Request $request): Employee
    {
        $employeeIdentifier = $request->input('employee_id');

        if ($employeeIdentifier) {
            return $this->findAttendanceEmployee($employeeIdentifier);
        }

        $employee = $request->user()?->employee;

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee_id' => 'Employee ID is required for attendance actions.',
            ]);
        }

        return $employee->load(['person', 'department', 'position.salaryGrade']);
    }

    private function findAttendanceEmployee(string $identifier): Employee
    {
        return Employee::with(['person', 'department', 'position.salaryGrade'])
            ->where('employee_id', $identifier)
            ->orWhere('employee_code', $identifier)
            ->firstOrFail();
    }

    private function attendancePeriod(Request $request): array
    {
        $request->merge([
            'start_date' => $request->input('start_date', $request->input('period_start')),
            'end_date' => $request->input('end_date', $request->input('period_end')),
        ]);

        $data = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        return [
            Carbon::parse($data['start_date'])->toDateString(),
            Carbon::parse($data['end_date'])->toDateString(),
        ];
    }

    private function attendanceRowsForEmployee(int $employeeId, string $start, string $end)
    {
        return AttendanceLog::with([
                'employee.person',
                'employee.department',
                'employee.position.salaryGrade',
                'schedule',
                'overtimeRequest',
            ])
            ->where('employee_id', $employeeId)
            ->whereBetween('attendance_date', [$start, $end])
            ->orderBy('attendance_date')
            ->orderBy('time_in')
            ->get();
    }

    private function employeePayload(Employee $employee): array
    {
        return [
            'employee_id' => $employee->employee_id,
            'employee_code' => $employee->employee_code,
            'employee_name' => $employee->full_name ?: 'N/A',
            'position' => $employee->position?->title ?? $employee->position?->name ?? 'N/A',
            'department' => $employee->department?->name ?? 'N/A',
        ];
    }

    private function attendanceRecordPayload(AttendanceLog $attendance): array
    {
        $regular = round((float) $attendance->regular_hours, 2);
        $overtime = round((float) $attendance->overtime_hours, 2);
        $undertime = round((float) $attendance->undertime_hours, 2);
        $lateMinutes = (int) ($attendance->late_minutes ?? 0);
        $undertimeMinutes = (int) ($attendance->undertime_minutes ?? round($undertime * 60));

        return [
            'attendance_id' => $attendance->attendance_id,
            'employee_id' => $attendance->employee_id,
            'day' => $attendance->attendance_date?->format('D'),
            'date' => $attendance->attendance_date?->toDateString(),
            'assigned_schedule' => $attendance->schedule_time,
            'time_in' => $attendance->time_in?->toIso8601String(),
            'time_out' => $attendance->time_out?->toIso8601String(),
            'formatted_time_in' => $attendance->formatted_time_in ?: 'No Time In',
            'formatted_time_out' => $attendance->formatted_time_out ?: 'No Time Out',
            'time_in_selfie_url' => $attendance->time_in_selfie_url,
            'time_out_selfie_url' => $attendance->time_out_selfie_url,
            'time_in_location' => $attendance->time_in_latitude !== null && $attendance->time_in_longitude !== null
                ? ['lat' => (float) $attendance->time_in_latitude, 'lng' => (float) $attendance->time_in_longitude]
                : null,
            'time_out_location' => $attendance->time_out_latitude !== null && $attendance->time_out_longitude !== null
                ? ['lat' => (float) $attendance->time_out_latitude, 'lng' => (float) $attendance->time_out_longitude]
                : null,
            'regular_hours' => $regular,
            'overtime_hours' => $overtime,
            'total_hours' => round($regular + $overtime, 2),
            'late_minutes' => $lateMinutes,
            'undertime_minutes' => $undertimeMinutes,
            'late_undertime' => trim("{$lateMinutes} min late / {$undertimeMinutes} min undertime"),
            'attendance_state' => $attendance->attendance_state,
            'overtime_status' => $this->overtimeStatus($attendance),
            'approval_status' => $attendance->approval_status,
            'original_location' => $attendance->location,
        ];
    }

    private function summaryFromRecords($records): array
    {
        $regularHours = round((float) $records->sum('regular_hours'), 2);
        $overtimeHours = round((float) $records->sum('overtime_hours'), 2);
        $lateMinutes = (int) $records->sum('late_minutes');
        $undertimeMinutes = (int) $records->sum('undertime_minutes');

        return [
            'regular_hours' => $regularHours,
            'overtime_hours' => $overtimeHours,
            'total_hours' => round($regularHours + $overtimeHours, 2),
            'late_minutes' => $lateMinutes,
            'undertime_minutes' => $undertimeMinutes,
            'late_undertime' => trim("{$lateMinutes} min late / {$undertimeMinutes} min undertime"),
        ];
    }

    private function overtimeStatus(AttendanceLog $attendance): string
    {
        $status = $attendance->overtimeRequest?->status;
        if (in_array($status, ['approved', 'rejected'], true)) {
            return $status;
        }

        if ((float) $attendance->overtime_hours <= 0) {
            return 'not_applicable';
        }

        if ((bool) $attendance->overtime_approved) {
            return 'approved';
        }

        return 'pending';
    }

    private function generatePayrollFromAttendance(
        Employee $employee,
        string $start,
        string $end,
        ?string $notes,
        PayrollService $payrollService,
        AttendanceService $attendanceService
    ): Payroll {
        if (! $this->isPayrollCutoff($start, $end)) {
            throw ValidationException::withMessages([
                'period' => 'Payroll saving is only allowed for 1-15 or 16-end of month cutoff periods.',
            ]);
        }

        $attendance = $this->attendanceRowsForEmployee($employee->employee_id, $start, $end);
        if ($attendance->isEmpty()) {
            throw ValidationException::withMessages([
                'employee_id' => "{$employee->full_name} has no attendance records for this payroll period.",
            ]);
        }

        $missing = $attendance->first(fn (AttendanceLog $row) => ! $row->time_in || ! $row->time_out);
        if ($missing) {
            $state = ! $missing->time_in ? 'No Time In' : 'No Time Out';
            throw ValidationException::withMessages([
                'attendance' => "Cannot save to payroll. {$employee->full_name} has {$state} on {$missing->attendance_date?->toDateString()}.",
            ]);
        }

        $attendance = $attendance->map(function (AttendanceLog $row) use ($attendanceService) {
            $row = $attendanceService->recalculate($row);
            $row->load(['overtimeRequest']);
            return $row;
        });

        $notApproved = $attendance->first(
            fn (AttendanceLog $row) => $this->normalizeApprovalStatus($row->approval_status) !== 'approved'
        );
        if ($notApproved) {
            throw ValidationException::withMessages([
                'attendance' => "Cannot save to payroll. Approve the attendance record for {$notApproved->attendance_date?->toDateString()} first.",
            ]);
        }

        $unresolved = $attendance->first(fn (AttendanceLog $row) => $this->overtimeStatus($row) === 'pending');
        if ($unresolved) {
            throw ValidationException::withMessages([
                'overtime' => "Cannot save to payroll. Overtime on {$unresolved->attendance_date?->toDateString()} is still pending. Approve or decline it first.",
            ]);
        }

        return $payrollService->generate($employee->employee_id, $start, $end, $notes);
    }

    private function cutoffForDate($date): array
    {
        $attendanceDate = Carbon::parse($date);
        if ($attendanceDate->day <= 15) {
            return [
                $attendanceDate->copy()->startOfMonth()->toDateString(),
                $attendanceDate->copy()->day(15)->toDateString(),
            ];
        }

        return [
            $attendanceDate->copy()->day(16)->toDateString(),
            $attendanceDate->copy()->endOfMonth()->toDateString(),
        ];
    }

    private function isPayrollCutoff(string $start, string $end): bool
    {
        $startDate = Carbon::parse($start);
        $endDate = Carbon::parse($end);

        if (! $startDate->isSameMonth($endDate) || ! $startDate->isSameYear($endDate)) {
            return false;
        }

        $lastDay = $endDate->copy()->endOfMonth()->day;

        return ($startDate->day === 1 && $endDate->day === 15)
            || ($startDate->day === 16 && $endDate->day === $lastDay);
    }

    private function canGenerateForPeriod(string $start, string $end): bool
    {
        return $this->isPayrollCutoff($start, $end)
            && Carbon::parse($end)->endOfDay()->lessThanOrEqualTo(now());
    }


    private function excludeAnalyticsOnly($query, Request $request): void
    {
        if ($request->boolean('include_history') || ! Schema::hasColumn('schedules', 'booking_id')) {
            return;
        }

        $query->where(function ($attendanceQuery) {
            $attendanceQuery->whereNull('schedule_id')
                ->orWhereHas('schedule', function ($scheduleQuery) {
                    $scheduleQuery->whereNull('booking_id')
                        ->orWhereHas('booking', fn ($bookingQuery) =>
                            $bookingQuery->where('booking_no', 'not like', 'HIST-%')
                        );
                });
        });
    }

    private function normalizeApprovalStatus(?string $status): string
    {
        return match (strtolower((string) $status)) {
            'verified', 'approve', 'approved' => 'approved',
            'declined', 'reject', 'rejected' => 'rejected',
            default => 'pending',
        };
    }
}
