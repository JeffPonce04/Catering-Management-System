<?php
// app/Models/EventEquipment.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EventEquipment extends Model
{
    use HasFactory;

    protected $table = 'event_equipment';

    protected $fillable = [
        'event_id',
        'equipment_id',
        'quantity_out',
        'quantity_returned',
        'damaged',
        'missing',
        'status',
        'notes'
    ];

    protected $casts = [
        'quantity_out' => 'integer',
        'quantity_returned' => 'integer',
        'damaged' => 'integer',
        'missing' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_id', 'event_id');
    }

    public function equipment()
    {
        return $this->belongsTo(Equipment::class, 'equipment_id', 'equipment_id');
    }

    public function getPendingReturnAttribute()
    {
        return $this->quantity_out - $this->quantity_returned - $this->damaged - $this->missing;
    }

    public function getIsFullyReturnedAttribute()
    {
        return $this->pending_return == 0;
    }

    public function getReturnPercentageAttribute()
    {
        if ($this->quantity_out == 0) return 0;
        $returned = $this->quantity_returned + $this->damaged + $this->missing;
        return round(($returned / $this->quantity_out) * 100, 2);
    }
}
