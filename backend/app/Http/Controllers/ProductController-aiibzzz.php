<?php
// app/Http/Controllers/ProductController.php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\InventoryHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    /**
     * Display a listing of products
     */
    public function index(Request $request)
    {
        $query = Product::query();

        // Filter by category
        if ($request->has('category')) {
            $query->where('category', $request->category);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter expiring soon
        if ($request->boolean('expiring')) {
            $query->whereNotNull('expiry_date')
                ->where('expiry_date', '<=', now()->addDays(30));
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
                    ->orWhere('product_id', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');

        $allowedSorts = ['name', 'category', 'quantity', 'status', 'expiry_date', 'created_at'];
        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder);
        } else {
            $query->orderBy('name', 'asc');
        }

        $products = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $products
        ]);
    }

    /**
     * Store a newly created product
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'category' => 'required|string|max:100',
            'quantity' => 'required|integer|min:0',
            'unit' => 'required|string|max:20',
            'sku' => 'nullable|string|max:100|unique:products,sku',
            'sub_category' => 'nullable|string|max:100',
            'min_stock' => 'nullable|integer|min:0',
            'max_stock' => 'nullable|integer|min:0',
            'reorder_point' => 'nullable|integer|min:0',
            'location' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:255',
            'expiry_date' => 'nullable|date',
            'lead_time' => 'nullable|integer|min:0',
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
            // Generate product ID
            $count = Product::count() + 1;
            $productId = 'PRD-' . str_pad($count, 4, '0', STR_PAD_LEFT);

            $data = $request->all();
            $data['product_id'] = $productId;

            // Set default values for null fields
            $data['min_stock'] = $request->min_stock ?? 10;
            $data['max_stock'] = $request->max_stock ?? 100;
            $data['reorder_point'] = $request->reorder_point ?? 15;
            $data['lead_time'] = $request->lead_time ?? 0;

            $product = Product::create($data);

            // Determine status based on quantity
            $product->status = $this->determineProductStatus(
                $product->quantity,
                $product->min_stock,
                $product->max_stock
            );
            $product->save();

            // Create history entry
            InventoryHistory::create([
                'trackable_id' => $product->id,
                'trackable_type' => Product::class,
                'item_name' => $request->name,
                'type' => 'in',
                'quantity' => $request->quantity,
                'unit' => $request->unit,
                'date' => now(),
                'reason' => 'Initial stock',
                'performed_by' => auth()->user()->name ?? 'System',
                'details' => json_encode(['action' => 'created', 'quantity' => $request->quantity])
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Product created successfully',
                'data' => $product
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to create product',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified product
     */
    public function show($id)
    {
        $product = Product::where('product_id', $id)->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }

        // Load history
        $product->load(['history' => function ($query) {
            $query->orderBy('date', 'desc')->limit(10);
        }]);

        return response()->json([
            'success' => true,
            'data' => $product
        ]);
    }

    /**
     * Update the specified product
     */
    public function update(Request $request, $id)
    {
        $product = Product::where('product_id', $id)->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'category' => 'sometimes|string|max:100',
            'quantity' => 'sometimes|integer|min:0',
            'unit' => 'sometimes|string|max:20',
            'sku' => 'nullable|string|max:100|unique:products,sku,' . $product->id,
            'sub_category' => 'nullable|string|max:100',
            'min_stock' => 'nullable|integer|min:0',
            'max_stock' => 'nullable|integer|min:0',
            'reorder_point' => 'nullable|integer|min:0',
            'location' => 'nullable|string|max:255',
            'supplier' => 'nullable|string|max:255',
            'expiry_date' => 'nullable|date',
            'lead_time' => 'nullable|integer|min:0',
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
            $oldQuantity = $product->quantity;

            // Update product with request data, handling null values
            $updateData = [];
            foreach ($request->all() as $key => $value) {
                if ($value !== null) {
                    $updateData[$key] = $value;
                }
            }

            $product->update($updateData);

            // Ensure numeric fields have default values if they become null
            if ($product->quantity === null) {
                $product->quantity = 0;
            }
            if ($product->min_stock === null) {
                $product->min_stock = 10;
            }
            if ($product->max_stock === null) {
                $product->max_stock = 100;
            }
            if ($product->reorder_point === null) {
                $product->reorder_point = 15;
            }
            if ($product->lead_time === null) {
                $product->lead_time = 0;
            }

            // Update status based on new quantity
            $product->status = $this->determineProductStatus(
                $product->quantity,
                $product->min_stock,
                $product->max_stock
            );

            $product->save();

            // If quantity changed, create history
            if ($oldQuantity != $product->quantity) {
                $quantityDiff = $product->quantity - $oldQuantity;
                InventoryHistory::create([
                    'trackable_id' => $product->id,
                    'trackable_type' => Product::class,
                    'item_name' => $product->name,
                    'type' => $quantityDiff > 0 ? 'in' : 'out',
                    'quantity' => abs($quantityDiff),
                    'unit' => $product->unit,
                    'date' => now(),
                    'reason' => 'Stock adjustment',
                    'performed_by' => auth()->user()->name ?? 'System',
                    'details' => json_encode([
                        'old_quantity' => $oldQuantity,
                        'new_quantity' => $product->quantity
                    ])
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Product updated successfully',
                'data' => $product->fresh()
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to update product',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified product
     */
    public function destroy($id)
    {
        $product = Product::where('product_id', $id)->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }

        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Product deleted successfully'
        ]);
    }

    /**
     * Archive product
     */
    public function archive($id)
    {
        $product = Product::where('product_id', $id)->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }

        $product->active = false;
        $product->save();

        return response()->json([
            'success' => true,
            'message' => 'Product archived successfully'
        ]);
    }

    /**
     * Restore product
     */
    public function restore($id)
    {
        $product = Product::where('product_id', $id)->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }

        $product->active = true;
        $product->save();

        return response()->json([
            'success' => true,
            'message' => 'Product restored successfully'
        ]);
    }

    /**
     * Adjust stock
     */
    public function adjustStock(Request $request, $id)
    {
        $product = Product::where('product_id', $id)->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer',
            'reason' => 'required|string|max:255',
            'type' => 'required|in:in,out,adjustment',
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
            $oldQuantity = $product->quantity;
            $product->quantity += $request->quantity;

            // Ensure quantity doesn't go negative
            if ($product->quantity < 0) {
                $product->quantity = 0;
            }

            $product->status = $this->determineProductStatus(
                $product->quantity,
                $product->min_stock,
                $product->max_stock
            );
            $product->save();

            // Create history
            InventoryHistory::create([
                'trackable_id' => $product->id,
                'trackable_type' => Product::class,
                'item_name' => $product->name,
                'type' => $request->type,
                'quantity' => abs($request->quantity),
                'unit' => $product->unit,
                'date' => now(),
                'reason' => $request->reason,
                'performed_by' => auth()->user()->name ?? 'System',
                'notes' => $request->notes,
                'details' => json_encode([
                    'old_quantity' => $oldQuantity,
                    'new_quantity' => $product->quantity,
                    'adjustment' => $request->quantity
                ])
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Stock adjusted successfully',
                'data' => [
                    'old_quantity' => $oldQuantity,
                    'new_quantity' => $product->quantity,
                    'adjustment' => $request->quantity
                ]
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Failed to adjust stock',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get product statistics
     */
    public function getStats()
    {
        $stats = [
            'total_items' => Product::count(),
            'total_quantity' => Product::sum('quantity'),
            'low_stock' => Product::where('status', 'low-stock')->count(),
            'out_of_stock' => Product::where('status', 'out-of-stock')->count(),
            'expiring_soon' => Product::whereNotNull('expiry_date')
                ->where('expiry_date', '<=', now()->addDays(30))
                ->count(),
            'categories' => Product::select('category', DB::raw('count(*) as total'))
                ->groupBy('category')
                ->get()
        ];

        return response->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    /**
     * Get product categories
     */
    public function getCategories()
    {
        $categories = Product::select('category')
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
     * Determine product status based on quantity
     */
    private function determineProductStatus($quantity, $minStock, $maxStock)
    {
        if ($quantity <= 0) return 'out-of-stock';
        if ($quantity <= $minStock) return 'low-stock';
        if ($quantity >= $maxStock) return 'over-stock';
        return 'in-stock';
    }
}
