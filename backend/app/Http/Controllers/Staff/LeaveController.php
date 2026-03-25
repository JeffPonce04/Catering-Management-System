<?php
// app/Http/Controllers/Staff/LeaveController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class LeaveController extends Controller
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

    public function getPending()
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
                'total_days' => 0,
                'approved_days' => 0,
                'pending_days' => 0,
                'by_type' => []
            ]
        ]);
    }

    public function show($id)
    {
        return response()->json([
            'success' => true,
            'data' => null
        ]);
    }

    public function approve($id)
    {
        return response()->json([
            'success' => true,
            'message' => 'Leave approved'
        ]);
    }

    public function reject(Request $request, $id)
    {
        return response()->json([
            'success' => true,
            'message' => 'Leave rejected'
        ]);
    }

    public function cancel($id)
    {
        return response()->json([
            'success' => true,
            'message' => 'Leave cancelled'
        ]);
    }
}
