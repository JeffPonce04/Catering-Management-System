<?php
// app/Models/InventoryHistory.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InventoryHistory extends Model
{
    use HasFactory;

    protected $table = 'inventory_history';

    protected $fillable = [
        'trackable_id',
        'trackable_type',
        'item_name',
        'type',
        'quantity',
        'unit',
        'date',
        'reason',
        'performed_by',
        'event_id',
        'event_name',
        'damaged',
        'missing',
        'details',
        'notes'
    ];

    protected $casts = [
        'date' => 'datetime',
        'details' => 'array'
    ];

    public function trackable()
    {
        return $this->morphTo();
    }

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_id', 'event_id');
    }
}
