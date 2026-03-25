<?php
// app/Http/Controllers/ReportController.php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Equipment;
use App\Models\Event;
use App\Models\InventoryHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function inventoryReport(Request $request)
    {
        $products = Product::select('category', DB::raw('count(*) as total'), DB::raw('sum(quantity) as total_quantity'))
            ->groupBy('category')
            ->get();

        $equipment = Equipment::select('category', DB::raw('count(*) as total'), DB::raw('sum(total_quantity) as total_quantity'))
            ->groupBy('category')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'products' => $products,
                'equipment' => $equipment,
                'total_products' => Product::count(),
                'total_equipment' => Equipment::count(),
                'total_value' => 0 // Add calculation if you have prices
            ]
        ]);
    }

    public function equipmentUsageReport(Request $request)
    {
        $equipment = Equipment::select('name', 'equipment_id', 'total_quantity', 'in_use', 'available', 'damaged', 'missing')
            ->get()
            ->map(function ($item) {
                $item->utilization_rate = $item->total_quantity > 0
                    ? round(($item->in_use / $item->total_quantity) * 100, 2)
                    : 0;
                return $item;
            });

        return response()->json([
            'success' => true,
            'data' => $equipment
        ]);
    }

    public function eventsReport(Request $request)
    {
        $events = Event::with('equipment')
            ->select('id', 'event_id', 'name', 'date_out', 'expected_date_in', 'actual_date_in', 'status')
            ->get()
            ->map(function ($event) {
                $event->total_items = $event->equipment->sum('quantity_out');
                $event->returned_items = $event->equipment->sum('quantity_returned');
                $event->damaged_items = $event->equipment->sum('damaged');
                $event->missing_items = $event->equipment->sum('missing');
                return $event;
            });

        return response()->json([
            'success' => true,
            'data' => $events
        ]);
    }

    public function damagedItemsReport(Request $request)
    {
        $damaged = Equipment::where('damaged', '>', 0)
            ->select('name', 'equipment_id', 'category', 'damaged', 'condition')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $damaged
        ]);
    }

    public function export(Request $request)
    {
        // Implementation for exporting data
        return response()->json([
            'success' => true,
            'message' => 'Export functionality coming soon'
        ]);
    }
}
