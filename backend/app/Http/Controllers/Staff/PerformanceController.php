<?php
// app/Http/Controllers/Staff/PerformanceController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class PerformanceController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => []
        ]);
    }

    public function store(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'Performance review created'
        ]);
    }

    public function show($id)
    {
        return response()->json([
            'success' => true,
            'data' => null
        ]);
    }

    public function update(Request $request, $id)
    {
        return response()->json([
            'success' => true,
            'message' => 'Performance review updated'
        ]);
    }

    public function destroy($id)
    {
        return response()->json([
            'success' => true,
            'message' => 'Performance review deleted'
        ]);
    }

    public function getByEmployee($employeeId)
    {
        return response()->json([
            'success' => true,
            'data' => [
                'employee_id' => $employeeId,
                'total_reviews' => 0,
                'averages' => [
                    'attendance' => 0,
                    'productivity' => 0,
                    'quality' => 0,
                    'teamwork' => 0,
                    'customer_feedback' => 0,
                    'overall' => 0
                ],
                'reviews' => []
            ]
        ]);
    }
}
