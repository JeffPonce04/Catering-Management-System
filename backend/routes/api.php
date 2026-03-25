<?php

// routes/api.php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\EquipmentController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\InventoryHistoryController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SearchController;

// Staff Management Controllers
use App\Http\Controllers\Staff\DepartmentController;
use App\Http\Controllers\Staff\PositionController;
use App\Http\Controllers\Staff\EmployeeController;
use App\Http\Controllers\Staff\AttendanceController;
use App\Http\Controllers\Staff\LeaveController;
use App\Http\Controllers\Staff\ScheduleController;
use App\Http\Controllers\Staff\PayrollController;
use App\Http\Controllers\Staff\PerformanceController;
use App\Http\Controllers\Staff\SkillController;
use App\Http\Controllers\Staff\CertificationController;
use App\Http\Controllers\Staff\DocumentController;


// Public routes
Route::prefix('v1')->group(function () {

    // Test route
    Route::get('/test', function () {
        return response()->json([
            'success' => true,
            'message' => 'API is working!',
            'timestamp' => now(),
            'environment' => app()->environment()
        ]);
    });

    // Health check route (no auth required)
    Route::get('/health', function () {
        try {
            DB::connection()->getPdo();
            $dbStatus = 'connected';
        } catch (\Exception $e) {
            $dbStatus = 'disconnected';
        }

        return response()->json([
            'success' => true,
            'message' => 'API is healthy',
            'timestamp' => now(),
            'data' => [
                'api' => 'running',
                'database' => $dbStatus,
                'environment' => app()->environment()
            ]
        ]);
    });

    // Authentication routes
    Route::prefix('auth')->group(function () {
        Route::post('/send-otp', [AuthController::class, 'sendOtp']);
        Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
        Route::post('/resend-otp', [AuthController::class, 'resendOtp']);
        Route::post('/register', [AuthController::class, 'register']);
        Route::post('/login', [AuthController::class, 'login']);
    });

    // Protected routes (require authentication)
    Route::middleware('auth:sanctum')->group(function () {

        // Auth routes (authenticated)
        Route::prefix('auth')->group(function () {
            Route::post('/logout', [AuthController::class, 'logout']);
            Route::get('/user', [AuthController::class, 'user']);
            Route::put('/profile', [AuthController::class, 'updateProfile']);
            Route::post('/change-password', [AuthController::class, 'changePassword']);
        });

        // Products Routes
        Route::prefix('products')->group(function () {
            Route::get('/', [ProductController::class, 'index']);
            Route::post('/', [ProductController::class, 'store']);
            Route::get('/stats', [ProductController::class, 'getStats']);
            Route::get('/categories', [ProductController::class, 'getCategories']);
            Route::get('/{id}', [ProductController::class, 'show']);
            Route::put('/{id}', [ProductController::class, 'update']);
            Route::delete('/{id}', [ProductController::class, 'destroy']);
            Route::post('/{id}/adjust-stock', [ProductController::class, 'adjustStock']);
            Route::post('/{id}/archive', [ProductController::class, 'archive']);
            Route::post('/{id}/restore', [ProductController::class, 'restore']);
        });

        // Equipment Routes
        Route::prefix('equipment')->group(function () {
            Route::get('/', [EquipmentController::class, 'index']);
            Route::post('/', [EquipmentController::class, 'store']);
            Route::get('/stats', [EquipmentController::class, 'getStats']);
            Route::get('/categories', [EquipmentController::class, 'getCategories']);
            Route::get('/conditions', [EquipmentController::class, 'getConditions']);
            Route::get('/{id}', [EquipmentController::class, 'show']);
            Route::put('/{id}', [EquipmentController::class, 'update']);
            Route::delete('/{id}', [EquipmentController::class, 'destroy']);
            Route::post('/{id}/mark-damaged', [EquipmentController::class, 'markDamaged']);
            Route::post('/{id}/schedule-maintenance', [EquipmentController::class, 'scheduleMaintenance']);
            Route::post('/{id}/complete-maintenance', [EquipmentController::class, 'completeMaintenance']);
            Route::post('/{id}/archive', [EquipmentController::class, 'archive']);
            Route::post('/{id}/restore', [EquipmentController::class, 'restore']);
            Route::get('/{id}/history', [EquipmentController::class, 'history']);
        });

        // Events Routes
        Route::prefix('events')->group(function () {
            Route::get('/', [EventController::class, 'index']);
            Route::post('/', [EventController::class, 'store']);
            Route::get('/stats', [EventController::class, 'getStats']);
            Route::get('/upcoming', [EventController::class, 'getUpcoming']);
            Route::get('/ongoing', [EventController::class, 'getOngoing']);
            Route::get('/completed', [EventController::class, 'getCompleted']);
            Route::get('/overdue', [EventController::class, 'getOverdue']);
            Route::get('/{id}', [EventController::class, 'show']);
            Route::put('/{id}', [EventController::class, 'update']);
            Route::delete('/{id}', [EventController::class, 'destroy']);
            Route::post('/{id}/return', [EventController::class, 'returnEquipment']);
            Route::get('/{id}/equipment', [EventController::class, 'getEventEquipment']);
            Route::post('/{id}/cancel', [EventController::class, 'cancel']);
        });

        // History Routes
        Route::prefix('history')->group(function () {
            Route::get('/recent', [InventoryHistoryController::class, 'getRecentHistory']);
            Route::get('/summary', [InventoryHistoryController::class, 'getSummary']);
            Route::get('/by-date', [InventoryHistoryController::class, 'getByDateRange']);
            Route::get('/by-type/{type}', [InventoryHistoryController::class, 'getByType']);
            Route::get('/{type}/{id}', [InventoryHistoryController::class, 'getItemHistory'])
                ->whereIn('type', ['product', 'equipment']);
            Route::get('/event/{eventId}', [InventoryHistoryController::class, 'getEventHistory']);
        });

        // Dashboard Routes
        Route::prefix('dashboard')->group(function () {
            Route::get('/stats', [DashboardController::class, 'getStats']);
            Route::get('/alerts', [DashboardController::class, 'getAlerts']);
            Route::get('/recent-activity', [DashboardController::class, 'getRecentActivity']);
            Route::get('/low-stock', [DashboardController::class, 'getLowStock']);
            Route::get('/expiring-soon', [DashboardController::class, 'getExpiringSoon']);
            Route::get('/maintenance-due', [DashboardController::class, 'getMaintenanceDue']);
            Route::get('/popular-items', [DashboardController::class, 'getPopularItems']);
            Route::get('/monthly-summary', [DashboardController::class, 'getMonthlySummary']);
        });

        // Reports Routes
        Route::prefix('reports')->group(function () {
            Route::get('/inventory', [ReportController::class, 'inventoryReport']);
            Route::get('/equipment-usage', [ReportController::class, 'equipmentUsageReport']);
            Route::get('/events', [ReportController::class, 'eventsReport']);
            Route::get('/damaged-items', [ReportController::class, 'damagedItemsReport']);
            Route::post('/export', [ReportController::class, 'export']);
        });

        // Search Routes
        Route::prefix('search')->group(function () {
            Route::get('/all', [SearchController::class, 'searchAll']);
            Route::get('/products', [SearchController::class, 'searchProducts']);
            Route::get('/equipment', [SearchController::class, 'searchEquipment']);
            Route::get('/events', [SearchController::class, 'searchEvents']);
        });

        // ========== STAFF MANAGEMENT ROUTES (COMPLETELY FIXED) ==========
        Route::prefix('staff')->group(function () {

            // Employees - FIXED (use API Resource style)
            Route::get('/employees', [EmployeeController::class, 'index']);
            Route::post('/employees', [EmployeeController::class, 'store']);
            Route::get('/employees/stats', [EmployeeController::class, 'getStats']);
            Route::get('/employees/by-department/{departmentId}', [EmployeeController::class, 'getByDepartment']);
            Route::post('/employees/bulk-status', [EmployeeController::class, 'bulkUpdateStatus']);
            Route::post('/employees/bulk-archive', [EmployeeController::class, 'bulkArchive']);
            Route::get('/employees/{employee}', [EmployeeController::class, 'show']);
            Route::put('/employees/{employee}', [EmployeeController::class, 'update']);
            Route::post('/employees/{employee}', [EmployeeController::class, 'update']); // For file uploads
            Route::delete('/employees/{employee}', [EmployeeController::class, 'destroy']);
            Route::post('/employees/{employee}/toggle-bookmark', [EmployeeController::class, 'toggleBookmark']);

            // Departments
            Route::get('/departments', [DepartmentController::class, 'index']);
            Route::post('/departments', [DepartmentController::class, 'store']);
            Route::get('/departments/{department}', [DepartmentController::class, 'show']);
            Route::put('/departments/{department}', [DepartmentController::class, 'update']);
            Route::delete('/departments/{department}', [DepartmentController::class, 'destroy']);
            Route::get('/departments/{department}/employees', [DepartmentController::class, 'getEmployees']);
            Route::get('/departments/{department}/positions', [DepartmentController::class, 'getPositions']);

            // Positions
            Route::get('/positions', [PositionController::class, 'index']);
            Route::post('/positions', [PositionController::class, 'store']);
            Route::get('/positions/{position}', [PositionController::class, 'show']);
            Route::put('/positions/{position}', [PositionController::class, 'update']);
            Route::delete('/positions/{position}', [PositionController::class, 'destroy']);
            Route::get('/positions/{position}/employees', [PositionController::class, 'getEmployees']);

            // Attendance
            Route::get('/attendance', [AttendanceController::class, 'index']);
            Route::get('/attendance/today', [AttendanceController::class, 'getToday']);
            Route::get('/attendance/summary', [AttendanceController::class, 'getSummary']);
            Route::post('/attendance/check-in', [AttendanceController::class, 'checkIn']);
            Route::post('/attendance/check-out', [AttendanceController::class, 'checkOut']);
            Route::post('/attendance/mark', [AttendanceController::class, 'markAttendance']);
            Route::get('/attendance/employee/{employee}', [AttendanceController::class, 'getByEmployee']);

            // Leaves
            Route::get('/leaves', [LeaveController::class, 'index']);
            Route::post('/leaves', [LeaveController::class, 'store']);
            Route::get('/leaves/summary', [LeaveController::class, 'getSummary']);
            Route::get('/leaves/pending', [LeaveController::class, 'getPending']);
            Route::get('/leaves/{leave}', [LeaveController::class, 'show']);
            Route::post('/leaves/{leave}/approve', [LeaveController::class, 'approve']);
            Route::post('/leaves/{leave}/reject', [LeaveController::class, 'reject']);
            Route::post('/leaves/{leave}/cancel', [LeaveController::class, 'cancel']);

            // Schedules
            Route::get('/schedules', [ScheduleController::class, 'index']);
            Route::post('/schedules', [ScheduleController::class, 'store']);
            Route::get('/schedules/week', [ScheduleController::class, 'getWeek']);
            Route::get('/schedules/month', [ScheduleController::class, 'getMonth']);
            Route::get('/schedules/employee/{employee}', [ScheduleController::class, 'getByEmployee']);
            Route::get('/schedules/{schedule}', [ScheduleController::class, 'show']);
            Route::put('/schedules/{schedule}', [ScheduleController::class, 'update']);
            Route::delete('/schedules/{schedule}', [ScheduleController::class, 'destroy']);

            // Payroll
            Route::get('/payroll', [PayrollController::class, 'index']);
            Route::get('/payroll/periods', [PayrollController::class, 'getPeriods']);
            Route::post('/payroll/periods', [PayrollController::class, 'createPeriod']);
            Route::get('/payroll/periods/{period}', [PayrollController::class, 'showPeriod']);
            Route::post('/payroll/generate', [PayrollController::class, 'generate']);
            Route::get('/payroll/employee/{employee}', [PayrollController::class, 'getByEmployee']);
            Route::get('/payroll/{payroll}', [PayrollController::class, 'show']);
            Route::post('/payroll/{payroll}/process', [PayrollController::class, 'process']);
            Route::post('/payroll/{payroll}/pay', [PayrollController::class, 'markAsPaid']);
            Route::get('/payroll/{payroll}/payslip', [PayrollController::class, 'generatePayslip']);

            // Performance
            Route::get('/performance', [PerformanceController::class, 'index']);
            Route::post('/performance', [PerformanceController::class, 'store']);
            Route::get('/performance/employee/{employee}', [PerformanceController::class, 'getByEmployee']);
            Route::get('/performance/{performance}', [PerformanceController::class, 'show']);
            Route::put('/performance/{performance}', [PerformanceController::class, 'update']);
            Route::delete('/performance/{performance}', [PerformanceController::class, 'destroy']);

            // Skills
            Route::get('/skills/employee/{employee}', [SkillController::class, 'getByEmployee']);
            Route::post('/skills/employee/{employee}', [SkillController::class, 'store']);
            Route::put('/skills/{skill}', [SkillController::class, 'update']);
            Route::delete('/skills/{skill}', [SkillController::class, 'destroy']);

            // Certifications
            Route::get('/certifications/employee/{employee}', [CertificationController::class, 'getByEmployee']);
            Route::post('/certifications/employee/{employee}', [CertificationController::class, 'store']);
            Route::put('/certifications/{certification}', [CertificationController::class, 'update']);
            Route::delete('/certifications/{certification}', [CertificationController::class, 'destroy']);

            // Documents
            Route::get('/documents/employee/{employee}', [DocumentController::class, 'getByEmployee']);
            Route::post('/documents/upload', [DocumentController::class, 'upload']);
            Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);
            Route::get('/documents/{document}/download', [DocumentController::class, 'download']);

            Route::prefix('staff')->group(function () {
                // ... existing routes ...

                // Attendance routes
                Route::get('/attendance', [AttendanceController::class, 'index']);
                Route::get('/attendance/today', [AttendanceController::class, 'getToday']);
                Route::get('/attendance/summary', [AttendanceController::class, 'getSummary']);
                Route::post('/attendance/check-in', [AttendanceController::class, 'checkIn']);
                Route::post('/attendance/check-out', [AttendanceController::class, 'checkOut']);
                Route::post('/attendance/mark', [AttendanceController::class, 'markAttendance']);
                Route::get('/attendance/employee/{employee}', [AttendanceController::class, 'getByEmployee']);

                // Leave routes
                Route::get('/leaves', [LeaveController::class, 'index']);
                Route::post('/leaves', [LeaveController::class, 'store']);
                Route::get('/leaves/summary', [LeaveController::class, 'getSummary']);
                Route::get('/leaves/pending', [LeaveController::class, 'getPending']);
                Route::get('/leaves/{leave}', [LeaveController::class, 'show']);
                Route::post('/leaves/{leave}/approve', [LeaveController::class, 'approve']);
                Route::post('/leaves/{leave}/reject', [LeaveController::class, 'reject']);
                Route::post('/leaves/{leave}/cancel', [LeaveController::class, 'cancel']);

                // Performance routes
                Route::get('/performance', [PerformanceController::class, 'index']);
                Route::post('/performance', [PerformanceController::class, 'store']);
                Route::get('/performance/employee/{employee}', [PerformanceController::class, 'getByEmployee']);
                Route::get('/performance/{performance}', [PerformanceController::class, 'show']);
                Route::put('/performance/{performance}', [PerformanceController::class, 'update']);
                Route::delete('/performance/{performance}', [PerformanceController::class, 'destroy']);
            });
        });
    });
});


// Fallback route for undefined routes
Route::fallback(function () {
    return response()->json([
        'success' => false,
        'message' => 'API endpoint not found. Please check the URL.'
    ], 404);
});
