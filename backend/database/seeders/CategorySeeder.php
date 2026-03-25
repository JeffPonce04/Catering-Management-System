<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Category;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        // Product Categories
        $productCategories = [
            ['name' => 'Grains', 'icon' => '🌾', 'sort_order' => 10],
            ['name' => 'Meat', 'icon' => '🥩', 'sort_order' => 20],
            ['name' => 'Pork', 'icon' => '🐷', 'sort_order' => 30],
            ['name' => 'Vegetables', 'icon' => '🥕', 'sort_order' => 40],
            ['name' => 'Frozen Products', 'icon' => '❄️', 'sort_order' => 50],
            ['name' => 'Drinks', 'icon' => '🥤', 'sort_order' => 60],
            ['name' => 'Sauces', 'icon' => '🥫', 'sort_order' => 70],
            ['name' => 'Dairy', 'icon' => '🥛', 'sort_order' => 80],
            ['name' => 'Bakery', 'icon' => '🥖', 'sort_order' => 90],
        ];

        foreach ($productCategories as $index => $cat) {
            Category::create([
                'category_id' => 'PRD-' . str_pad($index + 1, 3, '0', STR_PAD_LEFT),
                'name' => $cat['name'],
                'type' => 'product',
                'icon' => $cat['icon'],
                'sort_order' => $cat['sort_order']
            ]);
        }

        // Equipment Main Categories
        $mainCategories = [
            ['name' => 'Eating Utensils', 'sort_order' => 10],
            ['name' => 'Tableware', 'sort_order' => 20],
            ['name' => 'Serving Equipment', 'sort_order' => 30],
            ['name' => 'Cooking Equipment', 'sort_order' => 40],
            ['name' => 'Food Storage', 'sort_order' => 50],
            ['name' => 'Furniture', 'sort_order' => 60],
            ['name' => 'Cleaning & Hygiene', 'sort_order' => 70],
            ['name' => 'Extra Essentials', 'sort_order' => 80],
        ];

        foreach ($mainCategories as $index => $main) {
            Category::create([
                'category_id' => 'EQP-M' . str_pad($index + 1, 3, '0', STR_PAD_LEFT),
                'name' => $main['name'],
                'type' => 'equipment',
                'sort_order' => $main['sort_order']
            ]);
        }

        // Equipment Sub Categories
        $subCategories = [
            ['main' => 'Eating Utensils', 'name' => 'Spoons', 'icon' => '🥄', 'sort_order' => 10],
            ['main' => 'Eating Utensils', 'name' => 'Forks', 'icon' => '🍴', 'sort_order' => 20],
            ['main' => 'Eating Utensils', 'name' => 'Knives', 'icon' => '🔪', 'sort_order' => 30],
            ['main' => 'Tableware', 'name' => 'Plates', 'icon' => '🍽️', 'sort_order' => 10],
            ['main' => 'Tableware', 'name' => 'Bowls', 'icon' => '🥣', 'sort_order' => 20],
            ['main' => 'Tableware', 'name' => 'Glasses', 'icon' => '🥃', 'sort_order' => 30],
            ['main' => 'Tableware', 'name' => 'Mugs', 'icon' => '☕', 'sort_order' => 40],
            ['main' => 'Tableware', 'name' => 'Napkins', 'icon' => '🧻', 'sort_order' => 50],
            ['main' => 'Serving Equipment', 'name' => 'Serving Spoons', 'icon' => '🥄', 'sort_order' => 10],
            ['main' => 'Serving Equipment', 'name' => 'Ladles', 'icon' => '🥄', 'sort_order' => 20],
            ['main' => 'Serving Equipment', 'name' => 'Tongs', 'icon' => '🥢', 'sort_order' => 30],
            ['main' => 'Serving Equipment', 'name' => 'Serving Trays', 'icon' => '🍱', 'sort_order' => 40],
            ['main' => 'Serving Equipment', 'name' => 'Chafing Dishes', 'icon' => '🍲', 'sort_order' => 50],
            ['main' => 'Cooking Equipment', 'name' => 'Pots & Pans', 'icon' => '🍳', 'sort_order' => 10],
            ['main' => 'Cooking Equipment', 'name' => 'Chef Knives', 'icon' => '🔪', 'sort_order' => 20],
            ['main' => 'Cooking Equipment', 'name' => 'Cutting Boards', 'icon' => '🪵', 'sort_order' => 30],
            ['main' => 'Cooking Equipment', 'name' => 'Measuring Tools', 'icon' => '⚖️', 'sort_order' => 40],
            ['main' => 'Food Storage', 'name' => 'Storage Containers', 'icon' => '📦', 'sort_order' => 10],
            ['main' => 'Food Storage', 'name' => 'Food Carriers', 'icon' => '🧊', 'sort_order' => 20],
            ['main' => 'Food Storage', 'name' => 'Coolers', 'icon' => '❄️', 'sort_order' => 30],
            ['main' => 'Furniture', 'name' => 'Tables', 'icon' => '🪑', 'sort_order' => 10],
            ['main' => 'Furniture', 'name' => 'Chairs', 'icon' => '🪑', 'sort_order' => 20],
            ['main' => 'Furniture', 'name' => 'Tablecloths', 'icon' => '🧵', 'sort_order' => 30],
            ['main' => 'Cleaning & Hygiene', 'name' => 'Gloves', 'icon' => '🧤', 'sort_order' => 10],
            ['main' => 'Cleaning & Hygiene', 'name' => 'Aprons', 'icon' => '👕', 'sort_order' => 20],
            ['main' => 'Cleaning & Hygiene', 'name' => 'Sanitizers', 'icon' => '🧴', 'sort_order' => 30],
            ['main' => 'Extra Essentials', 'name' => 'Extension Cords', 'icon' => '🔌', 'sort_order' => 10],
            ['main' => 'Extra Essentials', 'name' => 'First Aid', 'icon' => '🚑', 'sort_order' => 20],
        ];

        foreach ($subCategories as $index => $sub) {
            $mainCat = Category::where('type', 'equipment')
                ->where('name', $sub['main'])
                ->whereNull('main_category')
                ->first();

            Category::create([
                'category_id' => 'EQP-S' . str_pad($index + 1, 3, '0', STR_PAD_LEFT),
                'name' => $sub['name'],
                'type' => 'equipment',
                'main_category' => $sub['main'],
                'icon' => $sub['icon'],
                'sort_order' => $sub['sort_order']
            ]);
        }
    }
}
