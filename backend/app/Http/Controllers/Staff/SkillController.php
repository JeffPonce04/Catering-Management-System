<?php
// app/Http/Controllers/Staff/SkillController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\EmployeeSkill;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SkillController extends Controller
{
    /**
     * Get skills by employee
     */
    public function getByEmployee($employeeId)
    {
        $employee = Employee::where('id', $employeeId)->orWhere('employee_id', $employeeId)->first();

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee not found'
            ], 404);
        }

        $skills = EmployeeSkill::where('employee_id', $employee->id)
            ->orderBy('skill_name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $skills
        ]);
    }

    /**
     * Store a new skill
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|exists:employees,id',
            'skill_name' => 'required|string|max:255',
            'proficiency' => 'required|in:beginner,intermediate,advanced,expert',
            'years_experience' => 'nullable|integer|min:0',
            'is_certified' => 'nullable|boolean',
            'notes' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check for duplicate skill
        $existing = EmployeeSkill::where('employee_id', $request->employee_id)
            ->where('skill_name', $request->skill_name)
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Skill already exists for this employee'
            ], 422);
        }

        $skill = EmployeeSkill::create([
            'employee_id' => $request->employee_id,
            'skill_name' => $request->skill_name,
            'proficiency' => $request->proficiency,
            'years_experience' => $request->years_experience ?? 0,
            'is_certified' => $request->is_certified ?? false,
            'notes' => $request->notes
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Skill added successfully',
            'data' => $skill
        ], 201);
    }

    /**
     * Update the specified skill
     */
    public function update(Request $request, $id)
    {
        $skill = EmployeeSkill::find($id);

        if (!$skill) {
            return response()->json([
                'success' => false,
                'message' => 'Skill not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'skill_name' => 'sometimes|string|max:255',
            'proficiency' => 'sometimes|in:beginner,intermediate,advanced,expert',
            'years_experience' => 'nullable|integer|min:0',
            'is_certified' => 'nullable|boolean',
            'notes' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check for duplicate if name changed
        if ($request->has('skill_name') && $request->skill_name != $skill->skill_name) {
            $existing = EmployeeSkill::where('employee_id', $skill->employee_id)
                ->where('skill_name', $request->skill_name)
                ->where('id', '!=', $skill->id)
                ->first();

            if ($existing) {
                return response()->json([
                    'success' => false,
                    'message' => 'Skill already exists for this employee'
                ], 422);
            }
        }

        $skill->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Skill updated successfully',
            'data' => $skill
        ]);
    }

    /**
     * Remove the specified skill
     */
    public function destroy($id)
    {
        $skill = EmployeeSkill::find($id);

        if (!$skill) {
            return response()->json([
                'success' => false,
                'message' => 'Skill not found'
            ], 404);
        }

        $skill->delete();

        return response()->json([
            'success' => true,
            'message' => 'Skill deleted successfully'
        ]);
    }
}
