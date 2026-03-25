<?php
// app/Http/Controllers/Staff/DepartmentController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Position;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class DepartmentController extends Controller
{
    /**
     * Display a listing of departments
     */
    public function index(Request $request)
    {
        $query = Department::query();

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('department_id', 'like', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // If no pagination requested, return all
        if ($request->has('all') && $request->all) {
            $departments = $query->withCount('employees')->get();
            return response()->json([
                'success' => true,
                'data' => $departments
            ]);
        }

        $departments = $query->withCount('employees')->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $departments
        ]);
    }

    /**
     * Store a newly created department
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:departments',
            'code' => 'required|string|max:50|unique:departments',
            'description' => 'nullable|string',
            'head_position' => 'nullable|string|max:255'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Generate department ID
        $count = Department::count() + 1;
        $departmentId = 'DEPT-' . str_pad($count, 3, '0', STR_PAD_LEFT);

        $department = Department::create([
            'department_id' => $departmentId,
            'name' => $request->name,
            'code' => strtoupper($request->code),
            'description' => $request->description,
            'head_position' => $request->head_position,
            'is_active' => true
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Department created successfully',
            'data' => $department
        ], 201);
    }

    /**
     * Display the specified department
     */
    public function show($id)
    {
        $department = Department::with(['positions', 'employees' => function ($q) {
            $q->limit(10);
        }])->where('id', $id)->orWhere('department_id', $id)->first();

        if (!$department) {
            return response()->json([
                'success' => false,
                'message' => 'Department not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $department
        ]);
    }

    /**
     * Update the specified department
     */
    public function update(Request $request, $id)
    {
        $department = Department::where('id', $id)->orWhere('department_id', $id)->first();

        if (!$department) {
            return response()->json([
                'success' => false,
                'message' => 'Department not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255|unique:departments,name,' . $department->id,
            'code' => 'sometimes|string|max:50|unique:departments,code,' . $department->id,
            'description' => 'nullable|string',
            'head_position' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $department->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Department updated successfully',
            'data' => $department
        ]);
    }

    /**
     * Remove the specified department
     */
    public function destroy($id)
    {
        $department = Department::where('id', $id)->orWhere('department_id', $id)->first();

        if (!$department) {
            return response()->json([
                'success' => false,
                'message' => 'Department not found'
            ], 404);
        }

        // Check if department has employees
        if ($department->employees()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete department with existing employees'
            ], 422);
        }

        $department->delete();

        return response()->json([
            'success' => true,
            'message' => 'Department deleted successfully'
        ]);
    }

    /**
     * Get employees by department
     */
    public function getEmployees($id)
    {
        $department = Department::where('id', $id)->orWhere('department_id', $id)->first();

        if (!$department) {
            return response()->json([
                'success' => false,
                'message' => 'Department not found'
            ], 404);
        }

        $employees = Employee::where('department_id', $department->id)
            ->with(['position'])
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $employees
        ]);
    }

    /**
     * Get positions by department
     */
    public function getPositions($id)
    {
        $department = Department::where('id', $id)->orWhere('department_id', $id)->first();

        if (!$department) {
            return response()->json([
                'success' => false,
                'message' => 'Department not found'
            ], 404);
        }

        $positions = Position::where('department_id', $department->id)
            ->where('is_active', true)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $positions
        ]);
    }
}
