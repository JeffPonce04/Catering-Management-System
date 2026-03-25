<?php
// app/Http/Controllers/ProductController.php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\InventoryHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ProductController extends Controller
{
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
        $query->orderBy($sortBy, $sortOrder);

        $products = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'success' => true,
            'data' => $products
        ]);
    }

    public function show($id)
    {
        $product = Product::where('product_id', $id)->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $product
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'category' => 'required|string',
            'quantity' => 'required|integer|min:0',
            'unit' => 'required|string',
            'min_stock' => 'nullable|integer|min:0',
            'max_stock' => 'nullable|integer|min:0',
            'location' => 'nullable|string',
            'supplier' => 'nullable|string',
            'expiry_date' => 'nullable|date'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // Generate product ID
        $count = Product::count() + 1;
        $productId = 'PRD-' . str_pad($count, 4, '0', STR_PAD_LEFT);

        $data = $request->all();
        $data['product_id'] = $productId;

        $product = Product::create($data);
        $product->updateStatus();

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
            'performed_by' => auth()->user()->name ?? 'System'
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Product created successfully',
            'data' => $product
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $product = Product::where('product_id', $id)->first();

        if (!$product) {
            return response()->json([
                'success' => false,
                'message' => 'Product not found'
            ], 404);
        }

        $product->update($request->all());
        $product->updateStatus();

        return response()->json([
            'success' => true,
            'message' => 'Product updated successfully',
            'data' => $product
        ]);
    }

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
            'reason' => 'required|string',
            'type' => 'required|in:in,out,adjustment'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $oldQuantity = $product->quantity;
        $product->quantity += $request->quantity;
        $product->save();
        $product->updateStatus();

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
            'notes' => $request->notes ?? null
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Stock adjusted successfully',
            'data' => [
                'old_quantity' => $oldQuantity,
                'new_quantity' => $product->quantity,
                'adjustment' => $request->quantity
            ]
        ]);
    }
}
