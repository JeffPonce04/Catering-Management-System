<?php
// app/Models/Event.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    use HasFactory;

    protected $table = 'events';

    protected $fillable = [
        'event_id',
        'name',
        'location',
        'date_out',
        'expected_date_in',
        'actual_date_in',
        'person_responsible',
        'contact_number',
        'notes',
        'status'
    ];

    protected $casts = [
        'date_out' => 'datetime',
        'expected_date_in' => 'datetime',
        'actual_date_in' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    public function equipment()
    {
        return $this->hasMany(EventEquipment::class, 'event_id', 'event_id');
    }

    public function equipmentItems()
    {
        return $this->belongsToMany(Equipment::class, 'event_equipment', 'event_id', 'equipment_id', 'event_id', 'equipment_id')
            ->withPivot('quantity_out', 'quantity_returned', 'damaged', 'missing', 'status')
            ->withTimestamps();
    }

    public function history()
    {
        return $this->hasMany(InventoryHistory::class, 'event_id', 'event_id');
    }

    public function getTotalItemsOutAttribute()
    {
        return $this->equipment->sum('quantity_out');
    }

    public function getTotalItemsReturnedAttribute()
    {
        return $this->equipment->sum('quantity_returned');
    }

    public function getTotalDamagedAttribute()
    {
        return $this->equipment->sum('damaged');
    }

    public function getTotalMissingAttribute()
    {
        return $this->equipment->sum('missing');
    }

    public function getIsOverdueAttribute()
    {
        return $this->status == 'ongoing' && now() > $this->expected_date_in;
    }

    public function getProgressAttribute()
    {
        $total = $this->total_items_out;
        if ($total == 0) return 0;
        $returned = $this->total_items_returned;
        return round(($returned / $total) * 100, 2);
    }

    public function updateStatus()
    {
        if ($this->actual_date_in) {
            $this->status = 'completed';
        } elseif ($this->date_out > now()) {
            $this->status = 'upcoming';
        } elseif ($this->is_overdue) {
            $this->status = 'overdue';
        } else {
            $this->status = 'ongoing';
        }
        $this->saveQuietly();
    }
}
