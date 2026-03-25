<?php
// app/Http/Controllers/SearchController.php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Equipment;
use App\Models\Event;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function searchAll(Request $request)
    {
        $query = $request->get('q');

        if (!$query) {
            return response()->json([
                'success' => true,
                'data' => []
            ]);
        }

        $products = Product::where('name', 'LIKE', "%{$query}%")
            ->orWhere('product_id', 'LIKE', "%{$query}%")
            ->orWhere('sku', 'LIKE', "%{$query}%")
            ->orWhere('category', 'LIKE', "%{$query}%")
            ->limit(5)
            ->get();

        $equipment = Equipment::where('name', 'LIKE', "%{$query}%")
            ->orWhere('equipment_id', 'LIKE', "%{$query}%")
            ->orWhere('category', 'LIKE', "%{$query}%")
            ->orWhere('sub_category', 'LIKE', "%{$query}%")
            ->limit(5)
            ->get();

        $events = Event::where('name', 'LIKE', "%{$query}%")
            ->orWhere('event_id', 'LIKE', "%{$query}%")
            ->orWhere('location', 'LIKE', "%{$query}%")
            ->orWhere('person_responsible', 'LIKE', "%{$query}%")
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'products' => $products,
                'equipment' => $equipment,
                'events' => $events
            ]
        ]);
    }

    public function searchProducts(Request $request)
    {
        $query = $request->get('q');

        $products = Product::where('name', 'LIKE', "%{$query}%")
            ->orWhere('product_id', 'LIKE', "%{$query}%")
            ->orWhere('sku', 'LIKE', "%{$query}%")
            ->orWhere('category', 'LIKE', "%{$query}%")
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $products
        ]);
    }

    public function searchEquipment(Request $request)
    {
        $query = $request->get('q');

        $equipment = Equipment::where('name', 'LIKE', "%{$query}%")
            ->orWhere('equipment_id', 'LIKE', "%{$query}%")
            ->orWhere('category', 'LIKE', "%{$query}%")
            ->orWhere('sub_category', 'LIKE', "%{$query}%")
            ->orWhere('model', 'LIKE', "%{$query}%")
            ->orWhere('serial_number', 'LIKE', "%{$query}%")
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $equipment
        ]);
    }

    public function searchEvents(Request $request)
    {
        $query = $request->get('q');

        $events = Event::where('name', 'LIKE', "%{$query}%")
            ->orWhere('event_id', 'LIKE', "%{$query}%")
            ->orWhere('location', 'LIKE', "%{$query}%")
            ->orWhere('person_responsible', 'LIKE', "%{$query}%")
            ->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $events
        ]);
    }
}
