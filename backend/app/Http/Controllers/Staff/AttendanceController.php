<?php
// app/Http/Controllers/Staff/AttendanceController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => []
        ]);
    }

    public function getToday()
    {
        return response()->json([
            'success' => true,
            'data' => []
        ]);
    }

    public function getSummary(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => [
                'present' => 0,
                'absent' => 0,
                'late' => 0,
                'on_leave' => 0,
                'total_days' => 0
            ]
        ]);
    }

    public function checkIn(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'Feature coming soon',
            'data' => null
        ]);
    }

    public function checkOut(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'Feature coming soon',
            'data' => null
        ]);
    }

    public function markAttendance(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'Feature coming soon',
            'data' => null
        ]);
    }

    public function getByEmployee($employeeId)
    {
        return response()->json([
            'success' => true,
            'data' => []
        ]);
    }
}
