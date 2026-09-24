<?php
// app/Http/Controllers/Api/ProfitabilityController.php

namespace App\Http\Controllers\Api;

use App\Models\Booking;
use App\Services\ProfitabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ProfitabilityController extends Controller
{
    protected ProfitabilityService $profitabilityService;

    public function __construct(ProfitabilityService $profitabilityService)
    {
        $this->profitabilityService = $profitabilityService;
    }

    /**
     * Get profitability for a specific booking.
     */
    public function show(Booking $booking, Request $request): JsonResponse
    {
        try {
            $booking->load([
                'serviceEvent.customer.person',
                'serviceEvent.eventType',
                'items.menuItem',
                'mealServices.menuItem',
                'payments',
                'invoice',
                'quotation',
                'charges',
                'equipment.equipment',
            ]);

            $useSnapshot = $request->boolean('use_snapshot', true);
            $profitability = $this->profitabilityService->getProfitability($booking, $useSnapshot);

            // Add booking details for display
            $profitability['booking'] = [
                'booking_id' => $booking->booking_id,
                'booking_no' => $booking->booking_no,
                'customer_name' => $booking->serviceEvent?->customer?->person?->full_name ?? 'Unknown',
                'event_type' => $booking->serviceEvent?->eventType?->name,
                'event_date' => $booking->serviceEvent?->event_date?->toDateString(),
                'event_time' => $booking->serviceEvent?->event_time,
                'venue' => $booking->serviceEvent?->venue,
                'pax' => (int) ($booking->serviceEvent?->guests_count ?? 0),
                'booking_status' => $booking->booking_status,
            ];

            return $this->ok($profitability);
        } catch (\Exception $e) {
            Log::error('Get booking profitability error: ' . $e->getMessage(), [
                'booking_id' => $booking->booking_id,
                'trace' => $e->getTraceAsString(),
            ]);
            return $this->fail('Failed to calculate profitability: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Create/save a cost snapshot for a booking.
     */
    public function saveSnapshot(Booking $booking, Request $request): JsonResponse
    {
        try {
            $snapshotType = $request->input('snapshot_type', 'projected');

            $profitability = $this->profitabilityService->calculateProfitability($booking, true, $snapshotType);
            $snapshot = $this->profitabilityService->saveSnapshot($booking, $profitability, $snapshotType);

            return $this->ok([
                'snapshot_id' => $snapshot->id,
                'profitability' => $profitability,
            ], 'Cost snapshot saved successfully.');
        } catch (\Exception $e) {
            Log::error('Save cost snapshot error: ' . $e->getMessage());
            return $this->fail('Failed to save snapshot: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get aggregate profitability report.
     */
    public function report(Request $request): JsonResponse
    {
        try {
            $filters = [
                'date_from' => $request->input('date_from'),
                'date_to' => $request->input('date_to'),
                'event_type_id' => $request->input('event_type_id'),
                'statuses' => $request->input('statuses', ['completed', 'confirmed']),
            ];

            $report = $this->profitabilityService->getAggregateReport($filters);

            return $this->ok($report);
        } catch (\Exception $e) {
            Log::error('Profitability report error: ' . $e->getMessage());
            return $this->fail('Failed to generate report: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get menu performance report.
     */
    public function menuPerformance(Request $request): JsonResponse
    {
        try {
            $filters = [
                'date_from' => $request->input('date_from'),
                'date_to' => $request->input('date_to'),
                'statuses' => $request->input('statuses', ['completed', 'confirmed']),
            ];

            $data = $this->profitabilityService->getMenuPerformance($filters);

            return $this->ok($data);
        } catch (\Exception $e) {
            Log::error('Menu performance error: ' . $e->getMessage());
            return $this->fail('Failed to get menu performance: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get dashboard KPIs.
     */
    public function dashboard(Request $request): JsonResponse
    {
        try {
            $today = now()->toDateString();
            $monthStart = now()->startOfMonth()->toDateString();
            $monthEnd = now()->endOfMonth()->toDateString();

            // Revenue today
            $revenueToday = Booking::whereHas('serviceEvent', fn($q) => $q->whereDate('event_date', $today))
                ->whereIn('booking_status', ['confirmed', 'completed'])
                ->with(['invoice', 'quotation'])
                ->get()
                ->sum(fn($b) => (float) ($b->invoice?->total_amount ?? $b->quotation?->total_amount ?? 0));

            // Revenue this month
            $revenueMonth = Booking::whereHas('serviceEvent', fn($q) => $q->whereBetween('event_date', [$monthStart, $monthEnd]))
                ->whereIn('booking_status', ['confirmed', 'completed'])
                ->with(['invoice', 'quotation'])
                ->get()
                ->sum(fn($b) => (float) ($b->invoice?->total_amount ?? $b->quotation?->total_amount ?? 0));

            // Get completed bookings for profitability
            $completedBookings = Booking::where('booking_status', 'completed')
                ->with(['serviceEvent', 'payments', 'invoice', 'quotation', 'charges', 'items.menuItem.recipeIngredients.ingredient'])
                ->get();

            $totalProfit = 0;
            foreach ($completedBookings as $booking) {
                $profitability = $this->profitabilityService->getProfitability($booking, true);
                $totalProfit += $profitability['profit'];
            }

            // Outstanding payments
            $outstanding = Booking::whereIn('booking_status', ['confirmed', 'completed'])
                ->with(['invoice', 'quotation', 'payments'])
                ->get()
                ->sum(function ($booking) {
                    $total = (float) ($booking->invoice?->total_amount ?? $booking->quotation?->total_amount ?? 0);
                    $paid = (float) $booking->payments->where('status', 'completed')->sum('amount');
                    return max(0, $total - $paid);
                });

            $completedCount = $completedBookings->count();
            $avgProfitMargin = 0;
            if ($completedCount > 0) {
                $totalRevenue = $completedBookings->sum(fn($b) => (float) ($b->invoice?->total_amount ?? $b->quotation?->total_amount ?? 0));
                $avgProfitMargin = $totalRevenue > 0 ? round(($totalProfit / $totalRevenue) * 100, 2) : 0;
            }

            return $this->ok([
                'revenue_today' => round($revenueToday, 2),
                'revenue_this_month' => round($revenueMonth, 2),
                'total_profit' => round($totalProfit, 2),
                'profit_margin' => $avgProfitMargin,
                'completed_bookings' => $completedCount,
                'outstanding_payments' => round($outstanding, 2),
            ]);
        } catch (\Exception $e) {
            Log::error('Dashboard error: ' . $e->getMessage());
            return $this->fail('Failed to load dashboard: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Save booking costs (manual override).
     */
    public function saveCosts(Booking $booking, Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'labor_cost' => ['nullable', 'numeric', 'min:0'],
                'delivery_cost' => ['nullable', 'numeric', 'min:0'],
                'equipment_cost' => ['nullable', 'numeric', 'min:0'],
                'other_cost' => ['nullable', 'numeric', 'min:0'],
                'service_fee' => ['nullable', 'numeric', 'min:0'],
                'delivery_fee' => ['nullable', 'numeric', 'min:0'],
                'extras_revenue' => ['nullable', 'numeric', 'min:0'],
            ]);

            // Store in settings
            \App\Models\Setting::updateOrCreate(
                ['group' => 'booking_costs', 'key' => 'booking_' . $booking->booking_id],
                ['value' => json_encode($validated), 'type' => 'json']
            );

            // Recalculate with new values
            $profitability = $this->profitabilityService->calculateProfitability($booking, true, 'actual');

            return $this->ok($profitability, 'Costs updated successfully.');
        } catch (\Exception $e) {
            Log::error('Save costs error: ' . $e->getMessage());
            return $this->fail('Failed to save costs: ' . $e->getMessage(), 500);
        }
    }
}