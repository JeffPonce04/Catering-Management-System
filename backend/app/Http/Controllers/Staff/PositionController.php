<?php
// app/Http/Controllers/Staff/PositionController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\Position;
use App\Models\Department;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PositionController extends Controller
{
    /**
     * Display a listing of positions
     */
    public function index(Request $request)
    {
        $query = Position::with('department');

        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('position_id', 'like', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->has('employment_type')) {
            $query->where('employment_type', $request->employment_type);
        }

        $positions = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $positions
        ]);
    }

    /**
     * Store a newly created position
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'department_id' => 'required|exists:departments,id',
            'description' => 'nullable|string',
            'base_salary' => 'nullable|numeric|min:0',
            'hourly_rate' => 'nullable|numeric|min:0',
            'employment_type' => 'nullable|in:full-time,part-time,contract,internship',
            'max_hours_per_week' => 'nullable|integer|min:1|max:168'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check if department exists
        $department = Department::find($request->department_id);
        if (!$department) {
            return response()->json([
                'success' => false,
                'message' => 'Department not found'
            ], 404);
        }

        // Generate position ID
        $count = Position::where('department_id', $request->department_id)->count() + 1;
        $positionId = 'POS-' . $department->code . '-' . str_pad($count, 3, '0', STR_PAD_LEFT);

        $position = Position::create([
            'position_id' => $positionId,
            'title' => $request->title,
            'department_id' => $request->department_id,
            'description' => $request->description,
            'responsibilities' => $request->responsibilities,
            'requirements' => $request->requirements,
            'base_salary' => $request->base_salary ?? 0,
            'hourly_rate' => $request->hourly_rate ?? 0,
            'employment_type' => $request->employment_type ?? 'full-time',
            'max_hours_per_week' => $request->max_hours_per_week,
            'is_active' => true
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Position created successfully',
            'data' => $position->load('department')
        ], 201);
    }

    /**
     * Display the specified position
     */
    public function show($id)
    {
        $position = Position::with(['department', 'employees' => function ($q) {
            $q->limit(10);
        }])->where('id', $id)->orWhere('position_id', $id)->first();

        if (!$position) {
            return response()->json([
                'success' => false,
                'message' => 'Position not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $position
        ]);
    }

    /**
     * Update the specified position
     */
    public function update(Request $request, $id)
    {
        $position = Position::where('id', $id)->orWhere('position_id', $id)->first();

        if (!$position) {
            return response()->json([
                'success' => false,
                'message' => 'Position not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'department_id' => 'sometimes|exists:departments,id',
            'description' => 'nullable|string',
            'base_salary' => 'nullable|numeric|min:0',
            'hourly_rate' => 'nullable|numeric|min:0',
            'employment_type' => 'nullable|in:full-time,part-time,contract,internship',
            'max_hours_per_week' => 'nullable|integer|min:1|max:168',
            'is_active' => 'sometimes|boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $position->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Position updated successfully',
            'data' => $position->load('department')
        ]);
    }

    /**
     * Remove the specified position
     */
    public function destroy($id)
    {
        $position = Position::where('id', $id)->orWhere('position_id', $id)->first();

        if (!$position) {
            return response()->json([
                'success' => false,
                'message' => 'Position not found'
            ], 404);
        }

        // Check if position has employees
        if ($position->employees()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete position with existing employees'
            ], 422);
        }

        $position->delete();

        return response()->json([
            'success' => true,
            'message' => 'Position deleted successfully'
        ]);
    }

    /**
     * Get employees by position
     */
    public function getEmployees($id)
    {
        $position = Position::where('id', $id)->orWhere('position_id', $id)->first();

        if (!$position) {
            return response()->json([
                'success' => false,
                'message' => 'Position not found'
            ], 404);
        }

        $employees = Employee::where('position_id', $position->id)
            ->with(['department'])
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $employees
        ]);
    }
}
