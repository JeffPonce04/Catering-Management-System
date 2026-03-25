<?php
// app/Http/Controllers/InventoryHistoryController.php

namespace App\Http\Controllers;

use App\Models\InventoryHistory;
use App\Models\Product;
use App\Models\Equipment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class InventoryHistoryController extends Controller
{
    public function getItemHistory(Request $request, $type, $id)
    {
        $model = $type === 'product' ? Product::class : Equipment::class;
        $idField = $type === 'product' ? 'product_id' : 'equipment_id';

        $item = $model::where($idField, $id)->first();

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => ucfirst($type) . ' not found'
            ], 404);
        }

        $history = InventoryHistory::where('trackable_id', $item->id)
            ->where('trackable_type', $model)
            ->orderBy('date', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $history
        ]);
    }

    public function getRecentHistory(Request $request)
    {
        $type = $request->get('type');

        $query = InventoryHistory::with('trackable');

        if ($type === 'product') {
            $query->where('trackable_type', Product::class);
        } elseif ($type === 'equipment') {
            $query->where('trackable_type', Equipment::class);
        }

        $history = $query->orderBy('date', 'desc')
            ->limit($request->get('limit', 50))
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'item_name' => $item->item_name,
                    'type' => $item->type,
                    'quantity' => $item->quantity,
                    'unit' => $item->unit,
                    'date' => $item->date,
                    'reason' => $item->reason,
                    'performed_by' => $item->performed_by,
                    'event_name' => $item->event_name,
                    'trackable_type' => $item->trackable_type
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $history
        ]);
    }

    public function getSummary(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $history = InventoryHistory::whereBetween('date', [$request->start_date, $request->end_date])
            ->get()
            ->groupBy('type')
            ->map(function ($items, $type) {
                return [
                    'total_quantity' => $items->sum('quantity'),
                    'count' => $items->count(),
                    'items' => $items->map(function ($item) {
                        return [
                            'item_name' => $item->item_name,
                            'quantity' => $item->quantity,
                            'date' => $item->date,
                            'reason' => $item->reason
                        ];
                    })
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $history
        ]);
    }
}
