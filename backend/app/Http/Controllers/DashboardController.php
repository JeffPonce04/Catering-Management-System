<?php
// app/Http/Controllers/DashboardController.php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Equipment;
use App\Models\Event;
use App\Models\EventEquipment;
use App\Models\InventoryHistory;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function getStats()
    {
        $products = Product::all();
        $equipment = Equipment::all();

        $stats = [
            'products' => [
                'total_items' => $products->count(),
                'total_quantity' => $products->sum('quantity'),
                'low_stock' => $products->where('status', 'low-stock')->count(),
                'out_of_stock' => $products->where('status', 'out-of-stock')->count(),
                'expiring_soon' => $products->filter(function ($p) {
                    return $p->expiry_date && now()->diffInDays($p->expiry_date) <= 30;
                })->count()
            ],
            'equipment' => [
                'total_items' => $equipment->count(),
                'total_quantity' => $equipment->sum('total_quantity'),
                'in_use' => $equipment->sum('in_use'),
                'available' => $equipment->sum('available'),
                'damaged' => $equipment->sum('damaged'),
                'missing' => $equipment->sum('missing'),
                'under_maintenance' => $equipment->sum('under_maintenance'),
                'utilization_rate' => $equipment->count() > 0
                    ? round(($equipment->sum('in_use') / $equipment->sum('total_quantity')) * 100, 2)
                    : 0
            ],
            'events' => [
                'ongoing' => Event::where('status', 'ongoing')->count(),
                'upcoming' => Event::where('status', 'upcoming')
                    ->where('date_out', '>', now())
                    ->count(),
                'completed_this_month' => Event::where('status', 'completed')
                    ->whereMonth('created_at', now()->month)
                    ->count(),
                'overdue' => Event::where('status', 'ongoing')
                    ->where('expected_date_in', '<', now())
                    ->count(),
                'total_equipment_out' => EventEquipment::sum('quantity_out'),
                'total_equipment_returned' => EventEquipment::sum('quantity_returned')
            ],
            'recent_activity' => InventoryHistory::with('trackable')
                ->orderBy('date', 'desc')
                ->limit(10)
                ->get()
                ->map(function ($history) {
                    return [
                        'id' => $history->id,
                        'item_name' => $history->item_name,
                        'type' => $history->type,
                        'quantity' => $history->quantity,
                        'unit' => $history->unit,
                        'date' => $history->date->format('Y-m-d H:i:s'),
                        'performed_by' => $history->performed_by,
                        'reason' => $history->reason
                    ];
                })
        ];

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    public function getAlerts()
    {
        $alerts = [];

        // Low stock alerts
        $lowStock = Product::where('status', 'low-stock')->get();
        foreach ($lowStock as $product) {
            $alerts[] = [
                'type' => 'warning',
                'title' => 'Low Stock Alert',
                'message' => "{$product->name} is running low ({$product->quantity} {$product->unit} remaining)",
                'item_id' => $product->product_id,
                'item_type' => 'product'
            ];
        }

        // Out of stock alerts
        $outOfStock = Product::where('status', 'out-of-stock')->get();
        foreach ($outOfStock as $product) {
            $alerts[] = [
                'type' => 'danger',
                'title' => 'Out of Stock',
                'message' => "{$product->name} is out of stock",
                'item_id' => $product->product_id,
                'item_type' => 'product'
            ];
        }

        // Expiring soon alerts
        $expiring = Product::whereNotNull('expiry_date')
            ->where('expiry_date', '<=', now()->addDays(30))
            ->where('expiry_date', '>', now())
            ->get();
        foreach ($expiring as $product) {
            $daysLeft = now()->diffInDays($product->expiry_date);
            $alerts[] = [
                'type' => 'info',
                'title' => 'Expiring Soon',
                'message' => "{$product->name} will expire in {$daysLeft} days",
                'item_id' => $product->product_id,
                'item_type' => 'product'
            ];
        }

        // Expired alerts
        $expired = Product::whereNotNull('expiry_date')
            ->where('expiry_date', '<', now())
            ->get();
        foreach ($expired as $product) {
            $daysOverdue = now()->diffInDays($product->expiry_date);
            $alerts[] = [
                'type' => 'danger',
                'title' => 'Expired',
                'message' => "{$product->name} expired {$daysOverdue} days ago",
                'item_id' => $product->product_id,
                'item_type' => 'product'
            ];
        }

        // Maintenance due alerts
        $maintenanceDue = Equipment::whereNotNull('next_maintenance')
            ->where('next_maintenance', '<=', now()->addDays(7))
            ->where('next_maintenance', '>', now())
            ->get();
        foreach ($maintenanceDue as $equipment) {
            $daysLeft = now()->diffInDays($equipment->next_maintenance);
            $alerts[] = [
                'type' => 'warning',
                'title' => 'Maintenance Due',
                'message' => "{$equipment->name} maintenance due in {$daysLeft} days",
                'item_id' => $equipment->equipment_id,
                'item_type' => 'equipment'
            ];
        }

        // Overdue maintenance
        $maintenanceOverdue = Equipment::whereNotNull('next_maintenance')
            ->where('next_maintenance', '<', now())
            ->get();
        foreach ($maintenanceOverdue as $equipment) {
            $daysOverdue = now()->diffInDays($equipment->next_maintenance);
            $alerts[] = [
                'type' => 'danger',
                'title' => 'Maintenance Overdue',
                'message' => "{$equipment->name} maintenance overdue by {$daysOverdue} days",
                'item_id' => $equipment->equipment_id,
                'item_type' => 'equipment'
            ];
        }

        // Overdue events
        $overdue = Event::where('status', 'ongoing')
            ->where('expected_date_in', '<', now())
            ->get();
        foreach ($overdue as $event) {
            $daysOverdue = now()->diffInDays($event->expected_date_in);
            $alerts[] = [
                'type' => 'danger',
                'title' => 'Event Overdue',
                'message' => "{$event->name} is {$daysOverdue} days overdue",
                'event_id' => $event->event_id
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $alerts
        ]);
    }
}
