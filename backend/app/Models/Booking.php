<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Booking extends Model
{
    use SoftDeletes;

    protected $table = 'bookings';
    protected $primaryKey = 'booking_id';
    protected $guarded = [];

    protected $casts = [
        'required_deposit' => 'float',
        'requested_date' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    // Relationships
    public function serviceEvent()
    {
        return $this->belongsTo(ServiceEvent::class, 'service_event_id', 'service_event_id');
    }

    public function quotation()
    {
        return $this->belongsTo(Quotation::class, 'quotation_id', 'quotation_id');
    }

    public function items()
    {
        return $this->hasMany(BookingItem::class, 'booking_id', 'booking_id');
    }

    public function equipment()
    {
        return $this->hasMany(BookingEquipment::class, 'booking_id', 'booking_id');
    }

    public function payments()
    {
        return $this->hasMany(BookingPayment::class, 'booking_id', 'booking_id');
    }

    public function charges()
    {
        return $this->hasMany(BookingCharge::class, 'booking_id', 'booking_id');
    }


    public function review()
    {
        return $this->hasOne(Review::class, 'booking_id', 'booking_id');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class, 'booking_id', 'booking_id');
    }

    public function eventDays()
    {
        return $this->hasMany(EventDay::class, 'booking_id', 'booking_id')->orderBy('day_number');
    }

    public function mealServices()
    {
        return $this->hasMany(MealService::class, 'booking_id', 'booking_id')
            ->orderBy('event_day_id')
            ->orderBy('serving_time')
            ->orderBy('meal_service_id');
    }


    public function eventChecklistItems()
    {
        return $this->hasMany(EventChecklistItem::class, 'booking_id', 'booking_id');
    }

    public function deliveryTrackings()
    {
        return $this->hasMany(EventDeliveryTracking::class, 'booking_id', 'booking_id');
    }

    public function order()
    {
        return $this->hasOne(Order::class, 'booking_id', 'booking_id');
    }

    public function invoice()
    {
        return $this->hasOne(Invoice::class, 'booking_id', 'booking_id');
    }

    public function tracking()
    {
        return $this->hasMany(EventTracking::class, 'booking_id', 'booking_id');
    }

    public function currentTracking()
    {
        return $this->hasOne(EventTracking::class, 'booking_id', 'booking_id')
            ->whereNull('stage_completed_at')
            ->latest();
    }

    // Accessors
    public function getTotalAmountAttribute()
    {
        return $this->quotation?->total_amount ?? 0;
    }

    public function getPaidAmountAttribute()
    {
        return $this->payments()->where('status', 'completed')->sum('amount');
    }

    public function getBalanceAttribute()
    {
        return max(0, $this->total_amount - $this->paid_amount);
    }

    public function getInventoryDeductedAttribute()
    {
        return (bool) Setting::getValue('inventory_deductions', 'booking_' . $this->booking_id, false);
    }
}