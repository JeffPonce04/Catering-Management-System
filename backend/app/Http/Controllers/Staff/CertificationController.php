<?php
// app/Http/Controllers/Staff/CertificationController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\EmployeeCertification;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class CertificationController extends Controller
{
    /**
     * Get certifications by employee
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

        $certifications = EmployeeCertification::where('employee_id', $employee->id)
            ->orderBy('issue_date', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $certifications
        ]);
    }

    /**
     * Store a new certification
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|exists:employees,id',
            'certification_name' => 'required|string|max:255',
            'issuing_organization' => 'required|string|max:255',
            'issue_date' => 'required|date',
            'expiry_date' => 'nullable|date|after:issue_date',
            'credential_id' => 'nullable|string|max:100',
            'credential_url' => 'nullable|url',
            'is_verified' => 'nullable|boolean',
            'metadata' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $certification = EmployeeCertification::create([
            'employee_id' => $request->employee_id,
            'certification_name' => $request->certification_name,
            'issuing_organization' => $request->issuing_organization,
            'issue_date' => $request->issue_date,
            'expiry_date' => $request->expiry_date,
            'credential_id' => $request->credential_id,
            'credential_url' => $request->credential_url,
            'is_verified' => $request->is_verified ?? false,
            'metadata' => $request->metadata
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Certification added successfully',
            'data' => $certification
        ], 201);
    }

    /**
     * Update the specified certification
     */
    public function update(Request $request, $id)
    {
        $certification = EmployeeCertification::find($id);

        if (!$certification) {
            return response()->json([
                'success' => false,
                'message' => 'Certification not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'certification_name' => 'sometimes|string|max:255',
            'issuing_organization' => 'sometimes|string|max:255',
            'issue_date' => 'sometimes|date',
            'expiry_date' => 'nullable|date|after:issue_date',
            'credential_id' => 'nullable|string|max:100',
            'credential_url' => 'nullable|url',
            'is_verified' => 'nullable|boolean',
            'metadata' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $certification->update($request->all());

        return response()->json([
            'success' => true,
            'message' => 'Certification updated successfully',
            'data' => $certification
        ]);
    }

    /**
     * Remove the specified certification
     */
    public function destroy($id)
    {
        $certification = EmployeeCertification::find($id);

        if (!$certification) {
            return response()->json([
                'success' => false,
                'message' => 'Certification not found'
            ], 404);
        }

        $certification->delete();

        return response()->json([
            'success' => true,
            'message' => 'Certification deleted successfully'
        ]);
    }
}
