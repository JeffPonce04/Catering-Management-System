<?php
// app/Http/Controllers/Staff/EmployeeController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Department;
use App\Models\Position;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class EmployeeController extends Controller
{
    /**
     * Display a listing of employees
     */
    public function index(Request $request)
    {
        try {
            $query = Employee::with(['department', 'position']);

            // Filter by department
            if ($request->has('department_id') && $request->department_id != 'all') {
                $query->where('department_id', $request->department_id);
            }

            // Filter by position
            if ($request->has('position_id') && $request->position_id != 'all') {
                $query->where('position_id', $request->position_id);
            }

            // Filter by employee type
            if ($request->has('employee_type') && $request->employee_type != 'all') {
                $query->where('employee_type', $request->employee_type);
            }

            // Filter by status
            if ($request->has('status') && $request->status != 'all') {
                $query->where('status', $request->status);
            } else {
                // Only exclude inactive if not specifically requesting it
                if (!$request->has('include_inactive') || !$request->boolean('include_inactive')) {
                    $query->where('status', '!=', 'inactive');
                }
            }

            // Filter by shift
            if ($request->has('shift') && $request->shift != 'all') {
                $query->where('shift_preference', $request->shift);
            }

            // Search
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('employee_id', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere(DB::raw("CONCAT(first_name, ' ', last_name)"), 'like', "%{$search}%");
                });
            }

            // Bookmarked only
            if ($request->boolean('bookmarked')) {
                $query->where('is_bookmarked', true);
            }

            // If 'all' parameter is true, return all without pagination
            if ($request->boolean('all')) {
                $employees = $query->get();
                return response()->json([
                    'success' => true,
                    'data' => $employees
                ]);
            }

            // Sorting
            $sortBy = $request->get('sort_by', 'first_name');
            $sortOrder = $request->get('sort_order', 'asc');

            // Handle special sort fields
            if ($sortBy === 'name') {
                $query->orderBy('first_name', $sortOrder)->orderBy('last_name', $sortOrder);
            } else if ($sortBy === 'department') {
                $query->join('departments', 'employees.department_id', '=', 'departments.id')
                    ->orderBy('departments.name', $sortOrder)
                    ->select('employees.*');
            } else if ($sortBy === 'position') {
                $query->join('positions', 'employees.position_id', '=', 'positions.id')
                    ->orderBy('positions.title', $sortOrder)
                    ->select('employees.*');
            } else {
                $query->orderBy($sortBy, $sortOrder);
            }

            $perPage = $request->get('per_page', 15);
            $employees = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $employees
            ]);
        } catch (\Exception $e) {
            Log::error('Employee index error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch employees',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created employee
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'middle_name' => 'nullable|string|max:100',
            'email' => 'required|email|unique:employees,email',
            'phone' => 'required|string|unique:employees,phone',
            'department_id' => 'required|exists:departments,id',
            'position_id' => 'required|exists:positions,id',
            'employee_type' => 'required|in:regular,oncall,probationary,contract',
            'status' => 'required|in:active,onleave',
            'shift_preference' => 'nullable|in:morning,afternoon,evening,night,flexible',
            'hire_date' => 'required|date',
            'monthly_salary' => 'nullable|numeric|min:0',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'country' => 'nullable|string|max:100',
            'emergency_contact' => 'nullable|string|max:100',
            'emergency_relation' => 'nullable|string|max:50',
            'emergency_phone' => 'nullable|string|max:20',
            'sss' => 'nullable|string|max:20|unique:employees,sss',
            'philhealth' => 'nullable|string|max:20|unique:employees,philhealth',
            'pagibig' => 'nullable|string|max:20|unique:employees,pagibig',
            'tin' => 'nullable|string|max:20|unique:employees,tin',
            'bank_name' => 'nullable|string|max:100',
            'bank_account' => 'nullable|string|max:50',
            'birth_date' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'notes' => 'nullable|string',
            'profile_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:2048'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            // Generate employee ID
            $prefix = $request->employee_type === 'regular' ? 'REG' : ($request->employee_type === 'oncall' ? 'ONC' : 'PRO');
            $count = Employee::where('employee_type', $request->employee_type)->count() + 1;
            $employeeId = $prefix . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);

            $data = $request->except(['skills', 'certifications', 'achievements', 'profile_photo']);
            $data['employee_id'] = $employeeId;
            $data['status'] = $request->status ?? 'active';

            // Handle profile photo if uploaded
            if ($request->hasFile('profile_photo')) {
                $path = $request->file('profile_photo')->store('employees', 'public');
                $data['profile_photo'] = $path;
            }

            // Handle skills, certifications, achievements as JSON
            if ($request->has('skills') && $request->skills) {
                $skills = is_string($request->skills) ? json_decode($request->skills, true) : $request->skills;
                $data['skills'] = is_array($skills) ? $skills : array_map('trim', explode(',', $request->skills));
            } else {
                $data['skills'] = [];
            }

            if ($request->has('certifications') && $request->certifications) {
                $certs = is_string($request->certifications) ? json_decode($request->certifications, true) : $request->certifications;
                $data['certifications'] = is_array($certs) ? $certs : array_map('trim', explode(',', $request->certifications));
            } else {
                $data['certifications'] = [];
            }

            if ($request->has('achievements') && $request->achievements) {
                $achievements = is_string($request->achievements) ? json_decode($request->achievements, true) : $request->achievements;
                $data['achievements'] = is_array($achievements) ? $achievements : array_map('trim', explode(',', $request->achievements));
            } else {
                $data['achievements'] = [];
            }

            $employee = Employee::create($data);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Employee created successfully',
                'data' => $employee->load(['department', 'position'])
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Employee store error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to create employee: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified employee
     */
    public function show($id)
    {
        try {
            $employee = Employee::with(['department', 'position'])
                ->where('id', $id)
                ->orWhere('employee_id', $id)
                ->first();

            if (!$employee) {
                return response()->json([
                    'success' => false,
                    'message' => 'Employee not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $employee
            ]);
        } catch (\Exception $e) {
            Log::error('Employee show error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get employee',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified employee
     */
    public function update(Request $request, $id)
    {
        $employee = Employee::where('id', $id)->orWhere('employee_id', $id)->first();

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'middle_name' => 'nullable|string|max:100',
            'email' => 'sometimes|email|unique:employees,email,' . $employee->id,
            'phone' => 'sometimes|string|unique:employees,phone,' . $employee->id,
            'department_id' => 'sometimes|exists:departments,id',
            'position_id' => 'sometimes|exists:positions,id',
            'employee_type' => 'sometimes|in:regular,oncall,probationary,contract',
            'status' => 'sometimes|in:active,inactive,onleave',
            'shift_preference' => 'sometimes|in:morning,afternoon,evening,night,flexible',
            'hire_date' => 'sometimes|date',
            'monthly_salary' => 'nullable|numeric|min:0',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'country' => 'nullable|string|max:100',
            'emergency_contact' => 'nullable|string|max:100',
            'emergency_relation' => 'nullable|string|max:50',
            'emergency_phone' => 'nullable|string|max:20',
            'sss' => 'nullable|string|max:20|unique:employees,sss,' . $employee->id,
            'philhealth' => 'nullable|string|max:20|unique:employees,philhealth,' . $employee->id,
            'pagibig' => 'nullable|string|max:20|unique:employees,pagibig,' . $employee->id,
            'tin' => 'nullable|string|max:20|unique:employees,tin,' . $employee->id,
            'bank_name' => 'nullable|string|max:100',
            'bank_account' => 'nullable|string|max:50',
            'birth_date' => 'nullable|date',
            'gender' => 'nullable|in:male,female,other',
            'notes' => 'nullable|string',
            'profile_photo' => 'nullable|image|mimes:jpeg,png,jpg|max:2048'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $data = $request->except(['skills', 'certifications', 'achievements', 'profile_photo', '_method']);

            // Handle profile photo if uploaded
            if ($request->hasFile('profile_photo')) {
                if ($employee->profile_photo) {
                    Storage::disk('public')->delete($employee->profile_photo);
                }
                $path = $request->file('profile_photo')->store('employees', 'public');
                $data['profile_photo'] = $path;
            }

            // Handle skills, certifications, achievements as JSON
            if ($request->has('skills') && $request->skills) {
                if (is_string($request->skills) && strpos($request->skills, '[') === 0) {
                    $data['skills'] = json_decode($request->skills, true);
                } else {
                    $data['skills'] = array_map('trim', explode(',', $request->skills));
                }
            }

            if ($request->has('certifications') && $request->certifications) {
                if (is_string($request->certifications) && strpos($request->certifications, '[') === 0) {
                    $data['certifications'] = json_decode($request->certifications, true);
                } else {
                    $data['certifications'] = array_map('trim', explode(',', $request->certifications));
                }
            }

            if ($request->has('achievements') && $request->achievements) {
                if (is_string($request->achievements) && strpos($request->achievements, '[') === 0) {
                    $data['achievements'] = json_decode($request->achievements, true);
                } else {
                    $data['achievements'] = array_map('trim', explode(',', $request->achievements));
                }
            }

            $employee->update($data);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Employee updated successfully',
                'data' => $employee->fresh()->load(['department', 'position'])
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Employee update error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update employee: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified employee (permanent delete)
     */
    public function destroy($id)
    {
        $employee = Employee::where('id', $id)->orWhere('employee_id', $id)->first();

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee not found'
            ], 404);
        }

        try {
            if ($employee->profile_photo) {
                Storage::disk('public')->delete($employee->profile_photo);
            }

            $employee->delete();

            return response()->json([
                'success' => true,
                'message' => 'Employee deleted permanently'
            ]);
        } catch (\Exception $e) {
            Log::error('Employee destroy error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete employee',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle bookmark
     */
    public function toggleBookmark($id)
    {
        $employee = Employee::where('id', $id)->orWhere('employee_id', $id)->first();

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee not found'
            ], 404);
        }

        try {
            $employee->is_bookmarked = !$employee->is_bookmarked;
            $employee->save();

            return response()->json([
                'success' => true,
                'message' => $employee->is_bookmarked ? 'Employee bookmarked' : 'Employee unbookmarked',
                'data' => ['is_bookmarked' => $employee->is_bookmarked]
            ]);
        } catch (\Exception $e) {
            Log::error('Employee toggleBookmark error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to toggle bookmark',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get employee statistics
     */
    public function getStats()
    {
        try {
            $stats = [
                'total_employees' => Employee::count(),
                'active' => Employee::where('status', 'active')->count(),
                'on_leave' => Employee::where('status', 'onleave')->count(),
                'inactive' => Employee::where('status', 'inactive')->count(),
                'regular' => Employee::where('employee_type', 'regular')->count(),
                'oncall' => Employee::where('employee_type', 'oncall')->count(),
                'probationary' => Employee::where('employee_type', 'probationary')->count(),
                'contract' => Employee::where('employee_type', 'contract')->count(),
                'by_department' => Employee::where('status', '!=', 'inactive')
                    ->select('department_id', DB::raw('count(*) as total'))
                    ->with('department:id,name')
                    ->groupBy('department_id')
                    ->get(),
                'by_position' => Employee::where('status', '!=', 'inactive')
                    ->select('position_id', DB::raw('count(*) as total'))
                    ->with('position:id,title')
                    ->groupBy('position_id')
                    ->get(),
                'recent_hires' => Employee::where('hire_date', '>=', now()->subDays(30))->count()
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);
        } catch (\Exception $e) {
            Log::error('Employee getStats error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get statistics',
                'data' => [
                    'total_employees' => 0,
                    'active' => 0,
                    'on_leave' => 0,
                    'inactive' => 0,
                    'regular' => 0,
                    'oncall' => 0,
                    'probationary' => 0,
                    'contract' => 0,
                    'by_department' => [],
                    'by_position' => [],
                    'recent_hires' => 0
                ]
            ], 500);
        }
    }

    /**
     * Bulk archive employees (set status to inactive)
     */
    public function bulkArchive(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'employee_ids' => 'required|array',
            'employee_ids.*' => 'required|integer'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $archivedCount = 0;

            foreach ($request->employee_ids as $employeeId) {
                $employee = Employee::where('id', $employeeId)
                    ->orWhere('employee_id', $employeeId)
                    ->first();

                if ($employee && $employee->status !== 'inactive') {
                    $employee->status = 'inactive';
                    $employee->save();
                    $archivedCount++;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "{$archivedCount} employees archived successfully",
                'data' => ['archived_count' => $archivedCount]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Employee bulkArchive error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to archive employees',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk update status
     */
    public function bulkUpdateStatus(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'employee_ids' => 'required|array',
            'employee_ids.*' => 'required|integer',
            'status' => 'required|in:active,inactive,onleave'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $updatedCount = 0;

            foreach ($request->employee_ids as $employeeId) {
                $employee = Employee::where('id', $employeeId)
                    ->orWhere('employee_id', $employeeId)
                    ->first();

                if ($employee) {
                    $employee->status = $request->status;
                    $employee->save();
                    $updatedCount++;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "{$updatedCount} employees updated successfully"
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Employee bulkUpdateStatus error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update status',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk delete employees
     */
    public function bulkDelete(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'employee_ids' => 'required|array',
            'employee_ids.*' => 'required|integer'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $deletedCount = 0;

            foreach ($request->employee_ids as $employeeId) {
                $employee = Employee::where('id', $employeeId)
                    ->orWhere('employee_id', $employeeId)
                    ->first();

                if ($employee) {
                    if ($employee->profile_photo) {
                        Storage::disk('public')->delete($employee->profile_photo);
                    }
                    $employee->delete();
                    $deletedCount++;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "{$deletedCount} employees deleted permanently"
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Employee bulkDelete error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete employees',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get employees by department
     */
    public function getByDepartment($departmentId)
    {
        try {
            $employees = Employee::where('department_id', $departmentId)
                ->where('status', '!=', 'inactive')
                ->with(['position'])
                ->get();

            return response()->json([
                'success' => true,
                'data' => $employees
            ]);
        } catch (\Exception $e) {
            Log::error('Employee getByDepartment error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to get employees by department',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
