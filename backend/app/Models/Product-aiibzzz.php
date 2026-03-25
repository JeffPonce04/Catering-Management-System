<?php
// app/Models/Product.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'products';

    protected $fillable = [
        'product_id',
        'name',
        'sku',
        'category',
        'sub_category',
        'quantity',
        'unit',
        'min_stock',
        'max_stock',
        'reorder_point',
        'reserved',
        'location',
        'supplier',
        'expiry_date',
        'lead_time',
        'status',
        'active',
        'notes',
        'popularity',
        'last_updated'
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'last_updated' => 'date',
        'active' => 'boolean',
        'quantity' => 'integer',
        'min_stock' => 'integer',
        'max_stock' => 'integer',
        'reorder_point' => 'integer',
        'reserved' => 'integer',
        'lead_time' => 'integer',
        'popularity' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime'
    ];

    protected $attributes = [
        'quantity' => 0,
        'min_stock' => 10,
        'max_stock' => 100,
        'reorder_point' => 15,
        'reserved' => 0,
        'lead_time' => 0,
        'popularity' => 0,
        'active' => true,
        'status' => 'in-stock'
    ];

    public function history()
    {
        return $this->morphMany(InventoryHistory::class, 'trackable');
    }

    public function getAvailableQuantityAttribute()
    {
        return ($this->quantity ?? 0) - ($this->reserved ?? 0);
    }

    public function getIsLowStockAttribute()
    {
        return ($this->quantity ?? 0) <= ($this->min_stock ?? 10);
    }

    public function getIsExpiringSoonAttribute()
    {
        return $this->expiry_date && now()->diffInDays($this->expiry_date) <= 30;
    }

    public function updateStatus()
    {
        $quantity = $this->quantity ?? 0;
        $minStock = $this->min_stock ?? 10;
        $maxStock = $this->max_stock ?? 100;

        if ($quantity <= 0) {
            $this->status = 'out-of-stock';
        } elseif ($quantity <= $minStock) {
            $this->status = 'low-stock';
        } elseif ($quantity >= $maxStock) {
            $this->status = 'over-stock';
        } else {
            $this->status = 'in-stock';
        }

        $this->saveQuietly();
    }
}
