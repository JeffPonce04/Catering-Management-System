<?php
// app/Http/Controllers/Staff/ScheduleController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ScheduleController extends Controller
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
            'message' => 'Feature coming soon',
            'data' => null
        ]);
    }

    public function getWeek(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => []
        ]);
    }

    public function getMonth(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => []
        ]);
    }

    public function getByEmployee($employeeId)
    {
        return response()->json([
            'success' => true,
            'data' => []
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
            'message' => 'Schedule updated'
        ]);
    }

    public function destroy($id)
    {
        return response()->json([
            'success' => true,
            'message' => 'Schedule deleted'
        ]);
    }
}
