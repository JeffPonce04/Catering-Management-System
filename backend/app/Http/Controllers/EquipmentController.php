<?php
// app/Http/Controllers/EquipmentController.php

namespace App\Http\Controllers;

use App\Models\Equipment;
use App\Models\InventoryHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class EquipmentController extends Controller
{
    /**
     * Display a listing of equipment
     */
    public function index(Request $request)
    {
        $query = Equipment::query();

        // Filter by category
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by condition
        if ($request->has('condition')) {
            $query->where('condition', $request->condition);
        }

        // Filter by active/inactive
        if ($request->has('active')) {
            $query->where('active', $request->boolean('active'));
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('equipment_id', 'like', "%{$search}%")
                    ->orWhere('model', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhere('sub_category', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');

        $allowedSorts = ['name', 'category', 'total_quantity', 'available', 'in_use', 'status', 'condition', 'created_at'];
        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        } else {
            $query->orderBy('name', 'asc');
        }

        $equipment = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $equipment
        ]);
    }

    /**
     * Store a newly created equipment
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:100',
            'sub_category' => 'nullable|string|max:100',
            'total_quantity' => 'required|integer|min:1',
            'model' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string|max:100|unique:equipment,serial_number',
            'location' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:255',
            'last_maintenance' => 'nullable|date',
            'condition' => 'nullable|in:Excellent,Good,Fair,Poor,Damaged',
            'notes' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            // Generate equipment ID
            $count = Equipment::count() + 1;
            $equipmentId = 'EQP-' . str_pad($count, 4, '0', STR_PAD_LEFT);

            // Prepare data
            $data = [
                'equipment_id' => $equipmentId,
                'name' => $request->name,
                'category' => $request->category,
                'sub_category' => $request->sub_category,
                'total_quantity' => $request->total_quantity,
                'available' => $request->total_quantity, // Set available equal to total_quantity
                'in_use' => 0,
                'damaged' => 0,
                'missing' => 0,
                'under_maintenance' => 0,
                'location' => $request->location,
                'supplier' => $request->supplier,
                'last_maintenance' => $request->last_maintenance,
                'condition' => $request->condition ?? 'Good',
                'status' => 'available',
                'active' => true,
                'model' => $request->model,
                'serial_number' => $request->serial_number,
                'notes' => $request->notes,
                'usage_count' => 0
            ];

            $equipment = Equipment::create($data);

            // Create history entry
            InventoryHistory::create([
                'trackable_id' => $equipment->id,
                'trackable_type' => Equipment::class,
                'item_name' => $request->name,
                'type' => 'in',
                'quantity' => $request->total_quantity,
                'unit' => 'pcs',
                'date' => now(),
                'reason' => 'Initial stock',
                'performed_by' => auth()->user()->name ?? 'System',
                'details' => json_encode(['action' => 'created', 'total_quantity' => $request->total_quantity])
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Equipment created successfully',
                'data' => $equipment
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create equipment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified equipment
     */
    public function show($id)
    {
        $equipment = Equipment::where('equipment_id', $id)->first();

        if (!$equipment) {
            return response()->json([
                'success' => false,
                'message' => 'Equipment not found'
            ], 404);
        }

        // Load history
        $equipment->load(['history' => function ($query) {
            $query->orderBy('date', 'desc')->limit(10);
        }]);

        return response()->json([
            'success' => true,
            'data' => $equipment
        ]);
    }

    /**
     * Update the specified equipment
     */
    public function update(Request $request, $id)
    {
        $equipment = Equipment::where('equipment_id', $id)->first();

        if (!$equipment) {
            return response()->json([
                'success' => false,
                'message' => 'Equipment not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'category' => 'sometimes|string|max:100',
            'sub_category' => 'nullable|string|max:100',
            'total_quantity' => 'sometimes|integer|min:0',
            'model' => 'nullable|string|max:100',
            'serial_number' => 'nullable|string|max:100|unique:equipment,serial_number,' . $equipment->id,
            'location' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:255',
            'last_maintenance' => 'nullable|date',
            'condition' => 'nullable|in:Excellent,Good,Fair,Poor,Damaged',
            'notes' => 'nullable|string',
            'active' => 'sometimes|boolean'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();

        try {
            $oldData = $equipment->toArray();

            // Update equipment
            $updateData = [];
            foreach ($request->all() as $key => $value) {
                if ($value !== null) {
                    $updateData[$key] = $value;
                }
            }

            $equipment->update($updateData);

            // If total_quantity changed, recalculate available
            if ($request->has('total_quantity') && $request->total_quantity != $oldData['total_quantity']) {
                $equipment->available = $request->total_quantity - $equipment->in_use - $equipment->damaged - $equipment->missing - $equipment->under_maintenance;

                // Create history for quantity change
                InventoryHistory::create([
                    'trackable_id' => $equipment->id,
                    'trackable_type' => Equipment::class,
                    'item_name' => $equipment->name,
                    'type' => 'adjustment',
                    'quantity' => abs($request->total_quantity - $oldData['total_quantity']),
                    'unit' => 'pcs',
                    'date' => now(),
                    'reason' => 'Quantity adjusted',
                    'performed_by' => auth()->user()->name ?? 'System',
                    'details' => json_encode([
                        'old_quantity' => $oldData['total_quantity'],
                        'new_quantity' => $request->total_quantity
                    ])
                ]);
            }

            // Update status based on current counts
            if ($equipment->damaged == $equipment->total_quantity) {
                $equipment->status = 'damaged';
            } elseif ($equipment->under_maintenance > 0) {
                $equipment->status = 'maintenance';
            } elseif ($equipment->in_use > 0 && $equipment->available == 0) {
                $equipment->status = 'in-use';
            } elseif ($equipment->available > 0) {
                $equipment->status = 'available';
            }

            $equipment->save();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Equipment updated successfully',
                'data' => $equipment->fresh()
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update equipment',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified equipment
     */
    public function destroy($id)
    {
        $equipment = Equipment::where('equipment_id', $id)->first();

        if (!$equipment) {
            return response()->json([
                'success' => false,
                'message' => 'Equipment not found'
            ], 404);
        }

        // Check if equipment is in use
        if ($equipment->in_use > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete equipment that is currently in use'
            ], 422);
        }

        $equipment->delete();

        return response()->json([
            'success' => true,
            'message' => 'Equipment deleted successfully'
        ]);
    }

    /**
     * Archive equipment
     */
    public function archive($id)
    {
        $equipment = Equipment::where('equipment_id', $id)->first();

        if (!$equipment) {
            return response()->json([
                'success' => false,
                'message' => 'Equipment not found'
            ], 404);
        }

        $equipment->active = false;
        $equipment->save();

        return response()->json([
            'success' => true,
            'message' => 'Equipment archived successfully'
        ]);
    }

    /**
     * Restore equipment
     */
    public function restore($id)
    {
        $equipment = Equipment::where('equipment_id', $id)->first();

        if (!$equipment) {
            return response()->json([
                'success' => false,
                'message' => 'Equipment not found'
            ], 404);
        }

        $equipment->active = true;
        $equipment->save();

        return response()->json([
            'success' => true,
            'message' => 'Equipment restored successfully'
        ]);
    }

    /**
     * Get equipment history
     */
    public function history($id)
    {
        $equipment = Equipment::where('equipment_id', $id)->first();

        if (!$equipment) {
            return response()->json([
                'success' => false,
                'message' => 'Equipment not found'
            ], 404);
        }

        $history = InventoryHistory::where('trackable_id', $equipment->id)
            ->where('trackable_type', Equipment::class)
            ->orderBy('date', 'desc')
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $history
        ]);
    }

    /**
     * Mark equipment as damaged
     */
    public function markDamaged(Request $request, $id)
    {
        $equipment = Equipment::where('equipment_id', $id)->first();

        if (!$equipment) {
            return response()->json([
                'success' => false,
                'message' => 'Equipment not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:255'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($equipment->available < $request->quantity) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient available quantity'
            ], 422);
        }

        DB::beginTransaction();

        try {
            $equipment->available -= $request->quantity;
            $equipment->damaged += $request->quantity;

            if ($equipment->damaged == $equipment->total_quantity) {
                $equipment->status = 'damaged';
            }

            $equipment->save();

            InventoryHistory::create([
                'trackable_id' => $equipment->id,
                'trackable_type' => Equipment::class,
                'item_name' => $equipment->name,
                'type' => 'damaged',
                'quantity' => $request->quantity,
                'unit' => 'pcs',
                'date' => now(),
                'reason' => $request->reason,
                'performed_by' => auth()->user()->name ?? 'System',
                'damaged' => $request->quantity,
                'details' => json_encode(['reason' => $request->reason])
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Equipment marked as damaged',
                'data' => $equipment->fresh()
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to mark equipment as damaged',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Schedule maintenance for equipment
     */
    public function scheduleMaintenance(Request $request, $id)
    {
        $equipment = Equipment::where('equipment_id', $id)->first();

        if (!$equipment) {
            return response()->json([
                'success' => false,
                'message' => 'Equipment not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'maintenance_date' => 'required|date|after:today',
            'quantity' => 'required|integer|min:1'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($equipment->available < $request->quantity) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient available quantity'
            ], 422);
        }

        DB::beginTransaction();

        try {
            $equipment->available -= $request->quantity;
            $equipment->under_maintenance += $request->quantity;
            $equipment->next_maintenance = $request->maintenance_date;
            $equipment->status = 'maintenance';
            $equipment->save();

            InventoryHistory::create([
                'trackable_id' => $equipment->id,
                'trackable_type' => Equipment::class,
                'item_name' => $equipment->name,
                'type' => 'maintenance',
                'quantity' => $request->quantity,
                'unit' => 'pcs',
                'date' => now(),
                'reason' => 'Scheduled maintenance',
                'performed_by' => auth()->user()->name ?? 'System',
                'details' => json_encode([
                    'maintenance_date' => $request->maintenance_date,
                    'quantity' => $request->quantity
                ])
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Maintenance scheduled successfully',
                'data' => $equipment->fresh()
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to schedule maintenance',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Complete maintenance for equipment
     */
    public function completeMaintenance(Request $request, $id)
    {
        $equipment = Equipment::where('equipment_id', $id)->first();

        if (!$equipment) {
            return response()->json([
                'success' => false,
                'message' => 'Equipment not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:1',
            'notes' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        if ($equipment->under_maintenance < $request->quantity) {
            return response()->json([
                'success' => false,
                'message' => 'Insufficient equipment under maintenance'
            ], 422);
        }

        DB::beginTransaction();

        try {
            $equipment->under_maintenance -= $request->quantity;
            $equipment->available += $request->quantity;
            $equipment->last_maintenance = now();

            if ($equipment->under_maintenance == 0) {
                $equipment->status = 'available';
            }

            $equipment->save();

            InventoryHistory::create([
                'trackable_id' => $equipment->id,
                'trackable_type' => Equipment::class,
                'item_name' => $equipment->name,
                'type' => 'in',
                'quantity' => $request->quantity,
                'unit' => 'pcs',
                'date' => now(),
                'reason' => 'Maintenance completed',
                'performed_by' => auth()->user()->name ?? 'System',
                'notes' => $request->notes,
                'details' => json_encode(['quantity' => $request->quantity])
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Maintenance completed successfully',
                'data' => $equipment->fresh()
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to complete maintenance',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get equipment statistics
     */
    public function getStats()
    {
        $stats = [
            'total_items' => Equipment::count(),
            'total_quantity' => Equipment::sum('total_quantity'),
            'in_use' => Equipment::sum('in_use'),
            'available' => Equipment::sum('available'),
            'damaged' => Equipment::sum('damaged'),
            'missing' => Equipment::sum('missing'),
            'under_maintenance' => Equipment::sum('under_maintenance'),
            'categories' => Equipment::select('category', DB::raw('count(*) as total'))
                ->groupBy('category')
                ->get()
        ];

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    /**
     * Get equipment categories
     */
    public function getCategories()
    {
        $categories = Equipment::select('category')
            ->distinct()
            ->whereNotNull('category')
            ->orderBy('category')
            ->pluck('category');

        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }

    /**
     * Get equipment conditions
     */
    public function getConditions()
    {
        return response()->json([
            'success' => true,
            'data' => ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']
        ]);
    }
}
