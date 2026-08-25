<?php

namespace App\Http\Controllers\Api;

use App\Models\AttendanceLog;
use App\Models\Booking;
use App\Models\BookingPayment;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\Ingredient;
use App\Models\InventoryStock;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quotation;
use App\Models\Review;
use App\Models\ServiceEvent;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        $now = now();
        $currentMonthStart = $now->copy()->startOfMonth();
        $currentMonthEnd = $now->copy()->endOfMonth();
        $previousMonthStart = $now->copy()->subMonthNoOverflow()->startOfMonth();
        $previousMonthEnd = $now->copy()->subMonthNoOverflow()->endOfMonth();

        $totalBookings = Booking::count();
        $completedBookings = Booking::where('booking_status', 'completed')->count();
        $cancelledBookings = Booking::where('booking_status', 'cancelled')->count();
        $validBookingBase = max(1, $totalBookings - $cancelledBookings);

        $currentRevenue = $this->netCompletedPayments($currentMonthStart, $currentMonthEnd);
        $previousRevenue = $this->netCompletedPayments($previousMonthStart, $previousMonthEnd);
        $currentBookings = Booking::whereBetween('created_at', [$currentMonthStart, $currentMonthEnd])->count();
        $previousBookings = Booking::whereBetween('created_at', [$previousMonthStart, $previousMonthEnd])->count();

        $outstandingBalance = Invoice::whereIn('status', ['unpaid', 'partial', 'overdue'])
            ->selectRaw('COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0) total')
            ->value('total');

        $data = [
            'total_bookings' => $totalBookings,
            'total_revenue' => round($this->netCompletedPayments(), 2),
            'active_orders' => Order::whereIn('status', ['pending', 'preparing', 'ready', 'ongoing'])->count(),
            'pending_quotations' => Quotation::where('status', 'pending')->count(),
            'low_stock_alerts' => InventoryStock::with('ingredient')
                ->whereColumn('current_quantity', '<=', 'reorder_point')
                ->orderBy('current_quantity')
                ->limit(12)
                ->get(),
            'staff_attendance_summary' => AttendanceLog::whereDate('attendance_date', today())
                ->selectRaw('status, COUNT(*) total')
                ->groupBy('status')
                ->get(),
            'recent_bookings' => Booking::with(['serviceEvent.customer.person', 'serviceEvent.eventType', 'quotation'])
                ->latest('booking_id')
                ->limit(8)
                ->get(),
            'upcoming_event_rows' => ServiceEvent::with(['customer.person', 'eventType', 'booking'])
                ->whereDate('event_date', '>=', today())
                ->whereIn('status', ['pending', 'confirmed', 'ongoing'])
                ->orderBy('event_date')
                ->limit(8)
                ->get(),
            'upcoming_events' => ServiceEvent::whereDate('event_date', '>=', today())
                ->whereIn('status', ['pending', 'confirmed', 'ongoing'])
                ->count(),
            'completed_events' => ServiceEvent::where('status', 'completed')->count(),
            'outstanding_balance' => round((float) $outstandingBalance, 2),
            'customer_count' => Customer::count(),
            'active_staff' => Employee::where('status', 'active')->count(),
            'completion_rate' => round(($completedBookings / $validBookingBase) * 100, 2),
            'avg_rating' => round((float) Review::where('is_approved', true)->avg('overall_rating'), 2),
            'revenue_growth' => $this->percentageChange($currentRevenue, $previousRevenue),
            'booking_growth' => $this->percentageChange($currentBookings, $previousBookings),
            'order_growth' => $this->percentageChange(
                Order::whereBetween('created_at', [$currentMonthStart, $currentMonthEnd])->count(),
                Order::whereBetween('created_at', [$previousMonthStart, $previousMonthEnd])->count()
            ),
            'payment_growth' => $this->percentageChange(
                BookingPayment::where('status', 'completed')->whereBetween('payment_date', [$currentMonthStart, $currentMonthEnd])->count(),
                BookingPayment::where('status', 'completed')->whereBetween('payment_date', [$previousMonthStart, $previousMonthEnd])->count()
            ),
            'customer_growth' => $this->percentageChange(
                Customer::whereBetween('created_at', [$currentMonthStart, $currentMonthEnd])->count(),
                Customer::whereBetween('created_at', [$previousMonthStart, $previousMonthEnd])->count()
            ),
        ];

        return $this->ok($this->filterStatsForRole($request, $data));
    }

    public function charts(Request $request)
    {
        [$startDate, $endDate, $dateFormat, $labelFormat] = $this->periodConfig($request->input('period', 'month'));

        $revenueData = BookingPayment::whereBetween('payment_date', [$startDate, $endDate])
            ->where('status', 'completed')
            ->selectRaw("DATE_FORMAT(payment_date, '{$dateFormat}') as bucket")
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_type = 'refund' THEN -ABS(amount) ELSE amount END), 0) as revenue")
            ->selectRaw("COUNT(DISTINCT booking_id) as orders")
            ->groupBy('bucket')
            ->orderBy('bucket')
            ->get()
            ->map(fn ($item) => [
                'date' => $this->formatBucketLabel($item->bucket, $labelFormat),
                'period' => $this->formatBucketLabel($item->bucket, $labelFormat),
                'revenue' => round((float) $item->revenue, 2),
                'orders' => (int) $item->orders,
            ]);

        $bookingTrends = Booking::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw("DATE_FORMAT(created_at, '{$dateFormat}') as bucket")
            ->selectRaw('COUNT(*) as bookings')
            ->selectRaw("SUM(CASE WHEN booking_status IN ('confirmed', 'completed') THEN 1 ELSE 0 END) as confirmed")
            ->selectRaw("SUM(CASE WHEN booking_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled")
            ->groupBy('bucket')
            ->orderBy('bucket')
            ->get()
            ->map(fn ($item) => [
                'period' => $this->formatBucketLabel($item->bucket, $labelFormat),
                'bookings' => (int) $item->bookings,
                'confirmed' => (int) $item->confirmed,
                'cancelled' => (int) $item->cancelled,
            ]);

        $inventoryDistribution = Ingredient::join('inventory_stocks', 'ingredients.ingredient_id', '=', 'inventory_stocks.ingredient_id')
            ->whereNull('ingredients.deleted_at')
            ->whereNotNull('ingredients.category')
            ->select('ingredients.category')
            ->selectRaw('COALESCE(SUM(inventory_stocks.current_quantity), 0) as value')
            ->groupBy('ingredients.category')
            ->orderByDesc('value')
            ->get()
            ->map(fn ($item) => [
                'name' => $item->category ?: 'Uncategorized',
                'value' => round((float) $item->value, 2),
            ]);

        $customerGrowth = Customer::whereBetween('created_at', [$startDate, $endDate])
            ->selectRaw("DATE_FORMAT(created_at, '{$dateFormat}') as bucket")
            ->selectRaw('COUNT(*) as newCustomers')
            ->groupBy('bucket')
            ->orderBy('bucket')
            ->get()
            ->map(fn ($item) => [
                'month' => $this->formatBucketLabel($item->bucket, $labelFormat),
                'newCustomers' => (int) $item->newCustomers,
            ]);

        $data = [
            'revenue_data' => $revenueData,
            'booking_trends' => $bookingTrends,
            'inventory_distribution' => $inventoryDistribution,
            'customer_growth' => $customerGrowth,
            'period' => $request->input('period', 'month'),
            'date_range' => [
                'start' => $startDate->toDateString(),
                'end' => $endDate->toDateString(),
            ],
        ];

        return $this->ok($this->filterChartsForRole($request, $data));
    }

    public function recentBookings()
    {
        return $this->ok(Booking::with(['serviceEvent.customer.person', 'serviceEvent.eventType', 'quotation'])->latest('booking_id')->limit(8)->get());
    }

    public function upcomingEvents()
    {
        return $this->ok(ServiceEvent::with(['customer.person', 'eventType', 'booking'])
            ->whereDate('event_date', '>=', today())
            ->whereIn('status', ['pending', 'confirmed', 'ongoing'])
            ->orderBy('event_date')
            ->limit(8)
            ->get());
    }

    public function lowStock()
    {
        return $this->ok(InventoryStock::with('ingredient')
            ->whereColumn('current_quantity', '<=', 'reorder_point')
            ->orderBy('current_quantity')
            ->limit(10)
            ->get());
    }

    public function todayAttendance()
    {
        return $this->ok(AttendanceLog::with(['employee.person', 'schedule'])
            ->whereDate('attendance_date', today())
            ->get());
    }

    public function revenueChart(Request $request)
    {
        return $this->charts($request);
    }

    public function eventDistribution()
    {
        return $this->ok(ServiceEvent::select('event_type_id')
            ->selectRaw('COUNT(*) as count')
            ->with('eventType')
            ->groupBy('event_type_id')
            ->get()
            ->map(fn ($item) => [
                'name' => $item->eventType?->name ?? 'Unknown',
                'value' => (int) $item->count,
            ]));
    }

    private function filterStatsForRole(Request $request, array $data): array
    {
        $role = $this->primaryOperationalRole($request);

        $keys = match ($role) {
            'cashier' => [
                'total_bookings', 'total_revenue', 'pending_quotations', 'recent_bookings',
                'upcoming_event_rows', 'upcoming_events', 'completed_events',
                'outstanding_balance', 'customer_count', 'completion_rate',
                'revenue_growth', 'booking_growth', 'payment_growth', 'customer_growth',
            ],
            'inventory-manager' => [
                'low_stock_alerts', 'upcoming_event_rows', 'upcoming_events',
            ],
            'staff-manager' => [
                'staff_attendance_summary', 'upcoming_event_rows', 'upcoming_events',
                'active_staff',
            ],
            default => array_keys($data),
        };

        return array_intersect_key($data, array_flip($keys));
    }

    private function filterChartsForRole(Request $request, array $data): array
    {
        $role = $this->primaryOperationalRole($request);

        $keys = match ($role) {
            'cashier' => ['revenue_data', 'booking_trends', 'customer_growth', 'period', 'date_range'],
            'inventory-manager' => ['inventory_distribution', 'period', 'date_range'],
            'staff-manager' => ['booking_trends', 'period', 'date_range'],
            default => array_keys($data),
        };

        return array_intersect_key($data, array_flip($keys));
    }

    private function primaryOperationalRole(Request $request): string
    {
        $roles = $request->user()?->roles()
            ->where('is_active', true)
            ->pluck('slug')
            ->map(fn ($role) => str_replace('_', '-', strtolower((string) $role)))
            ->all() ?? [];

        if (array_intersect($roles, ['super-admin', 'superadmin'])) {
            return 'super-admin';
        }
        if (array_intersect($roles, ['admin', 'administrator', 'owner'])) {
            return 'admin';
        }
        if (array_intersect($roles, ['cashier', 'finance', 'finance-staff'])) {
            return 'cashier';
        }
        if (array_intersect($roles, ['inventory-manager'])) {
            return 'inventory-manager';
        }
        if (array_intersect($roles, ['staff-manager', 'people-manager'])) {
            return 'staff-manager';
        }

        return 'other';
    }

    private function netCompletedPayments(?Carbon $startDate = null, ?Carbon $endDate = null): float
    {
        $query = BookingPayment::query()->where('status', 'completed');

        if ($startDate && $endDate) {
            $query->whereBetween('payment_date', [$startDate, $endDate]);
        }

        return (float) $query
            ->selectRaw("COALESCE(SUM(CASE WHEN payment_type = 'refund' THEN -ABS(amount) ELSE amount END), 0) as total")
            ->value('total');
    }

    private function percentageChange(float|int $current, float|int $previous): float
    {
        if ((float) $previous === 0.0) {
            return (float) $current > 0 ? 100.0 : 0.0;
        }

        return round((($current - $previous) / abs($previous)) * 100, 2);
    }

    private function periodConfig(string $period): array
    {
        return match ($period) {
            'day' => [now()->startOfDay(), now()->endOfDay(), '%Y-%m-%d %H:00:00', 'hour'],
            'week' => [now()->startOfWeek(), now()->endOfWeek(), '%Y-%m-%d', 'day'],
            'quarter' => [now()->startOfQuarter(), now()->endOfQuarter(), '%x-W%v', 'week'],
            'year' => [now()->startOfYear(), now()->endOfYear(), '%Y-%m', 'month'],
            default => [now()->startOfMonth(), now()->endOfMonth(), '%Y-%m-%d', 'day'],
        };
    }

    private function formatBucketLabel(string $bucket, string $format): string
    {
        try {
            return match ($format) {
                'hour' => Carbon::parse($bucket)->format('g A'),
                'day' => Carbon::parse($bucket)->format('M d'),
                'month' => Carbon::parse($bucket . '-01')->format('M'),
                default => $bucket,
            };
        } catch (\Throwable) {
            return $bucket;
        }
    }
}
