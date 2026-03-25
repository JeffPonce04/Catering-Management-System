<?php
// app/Models/Product.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

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
        'active' => 'boolean'
    ];

    public function history()
    {
        return $this->morphMany(InventoryHistory::class, 'trackable');
    }

    public function getAvailableQuantityAttribute()
    {
        return $this->quantity - $this->reserved;
    }

    public function getIsLowStockAttribute()
    {
        return $this->quantity <= $this->min_stock;
    }

    public function getIsExpiringSoonAttribute()
    {
        return $this->expiry_date && now()->diffInDays($this->expiry_date) <= 30;
    }

    public function updateStatus()
    {
        if ($this->quantity <= 0) {
            $this->status = 'out-of-stock';
        } elseif ($this->quantity <= $this->min_stock) {
            $this->status = 'low-stock';
        } elseif ($this->quantity >= $this->max_stock) {
            $this->status = 'over-stock';
        } else {
            $this->status = 'in-stock';
        }

        $this->saveQuietly();
    }
}
