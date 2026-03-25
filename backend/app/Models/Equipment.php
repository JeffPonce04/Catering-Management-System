<?php
// app/Models/Equipment.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Equipment extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'equipment';

    protected $fillable = [
        'equipment_id',
        'name',
        'model',
        'serial_number',
        'category',
        'sub_category',
        'total_quantity',
        'in_use',
        'available',
        'damaged',
        'missing',
        'under_maintenance',
        'location',
        'supplier',
        'last_maintenance',
        'next_maintenance',
        'condition',
        'status',
        'active',
        'notes',
        'usage_count'
    ];

    protected $casts = [
        'last_maintenance' => 'date',
        'next_maintenance' => 'date',
        'active' => 'boolean',
        'total_quantity' => 'integer',
        'in_use' => 'integer',
        'available' => 'integer',
        'damaged' => 'integer',
        'missing' => 'integer',
        'under_maintenance' => 'integer',
        'usage_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime'
    ];

    protected $attributes = [
        'in_use' => 0,
        'available' => 0,
        'damaged' => 0,
        'missing' => 0,
        'under_maintenance' => 0,
        'usage_count' => 0,
        'active' => true,
        'condition' => 'Good',
        'status' => 'available'
    ];

    public function history()
    {
        return $this->morphMany(InventoryHistory::class, 'trackable');
    }

    public function eventEquipment()
    {
        return $this->hasMany(EventEquipment::class, 'equipment_id', 'equipment_id');
    }

    public function events()
    {
        return $this->belongsToMany(Event::class, 'event_equipment', 'equipment_id', 'event_id', 'equipment_id', 'event_id')
            ->withPivot('quantity_out', 'quantity_returned', 'damaged', 'missing', 'status')
            ->withTimestamps();
    }

    public function getUtilizationRateAttribute()
    {
        if ($this->total_quantity == 0) return 0;
        return round(($this->in_use / $this->total_quantity) * 100, 2);
    }

    public function getAvailablePercentageAttribute()
    {
        if ($this->total_quantity == 0) return 0;
        return round(($this->available / $this->total_quantity) * 100, 2);
    }

    public function getConditionLabelAttribute()
    {
        $labels = [
            'Excellent' => 'Excellent',
            'Good' => 'Good',
            'Fair' => 'Fair',
            'Poor' => 'Poor',
            'Damaged' => 'Damaged'
        ];
        return $labels[$this->condition] ?? $this->condition;
    }

    public function getStatusLabelAttribute()
    {
        $labels = [
            'available' => 'Available',
            'in-use' => 'In Use',
            'maintenance' => 'Under Maintenance',
            'damaged' => 'Damaged',
            'retired' => 'Retired'
        ];
        return $labels[$this->status] ?? $this->status;
    }

    public function updateStatus()
    {
        if ($this->damaged == $this->total_quantity) {
            $this->status = 'damaged';
        } elseif ($this->under_maintenance > 0) {
            $this->status = 'maintenance';
        } elseif ($this->in_use > 0 && $this->available == 0) {
            $this->status = 'in-use';
        } elseif ($this->available > 0) {
            $this->status = 'available';
        } else {
            $this->status = 'retired';
        }
        $this->saveQuietly();
    }

    public function recalculateCounts()
    {
        $this->total_quantity = $this->available + $this->in_use + $this->damaged + $this->missing + $this->under_maintenance;
        $this->updateStatus();
    }
}
