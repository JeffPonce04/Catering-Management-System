<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class MenuItem extends Model
{
    use SoftDeletes;

    protected $table = 'menu_items';
    protected $primaryKey = 'menu_item_id';
    protected $guarded = [];

    protected $casts = [
        'price' => 'float',
        'cost_to_make' => 'float',
        'prep_time_minutes' => 'integer',
        'serving_size' => 'integer',
        'is_available' => 'boolean',
        'is_popular' => 'boolean',
        'is_vegetarian' => 'boolean',
        'is_vegan' => 'boolean',
        'is_gluten_free' => 'boolean',
        'is_halal' => 'boolean',
    ];

    protected $appends = ['image_full_url'];

    public function category()
    {
        return $this->belongsTo(MealCategory::class, 'category_id', 'category_id');
    }

    public function recipeIngredients()
    {
        return $this->hasMany(RecipeIngredient::class, 'menu_item_id', 'menu_item_id');
    }

    public function packageItems()
    {
        return $this->hasMany(PackageMenuItem::class, 'menu_item_id', 'menu_item_id');
    }

    public function packages()
    {
        return $this->belongsToMany(
            Package::class,
            'package_menu_items',
            'menu_item_id',
            'package_id',
            'menu_item_id',
            'package_id'
        )->withPivot([
            'package_menu_item_id',
            'quantity_per_pax',
            'is_optional',
            'is_replaceable',
            'additional_cost',
        ])->withTimestamps();
    }

    public function bookingItems()
    {
        return $this->hasMany(BookingItem::class, 'menu_item_id', 'menu_item_id');
    }

    // Accessor for full image URL
    public function getImageFullUrlAttribute()
    {
        if (!$this->image_url) {
            return null;
        }

        // If it's already a full URL or inline data image, return it
        if (str_starts_with($this->image_url, 'data:image/') || filter_var($this->image_url, FILTER_VALIDATE_URL)) {
            return $this->image_url;
        }

        // Check if file exists in storage
        if (Storage::disk('public')->exists($this->image_url)) {
            return Storage::disk('public')->url($this->image_url);
        }

        // Fallback to default
        return null;
    }
}