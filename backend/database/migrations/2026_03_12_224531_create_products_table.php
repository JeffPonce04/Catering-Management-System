<?php
// database/migrations/2024_03_11_000001_create_products_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('product_id')->unique();
            $table->string('name');
            $table->string('sku')->nullable();
            $table->string('category');
            $table->string('sub_category')->nullable();
            $table->integer('quantity')->default(0);
            $table->string('unit')->default('pcs');
            $table->integer('min_stock')->nullable();
            $table->integer('max_stock')->nullable();
            $table->integer('reorder_point')->nullable();
            $table->integer('reserved')->default(0);
            $table->string('location')->nullable();
            $table->string('supplier')->nullable();
            $table->date('expiry_date')->nullable();
            $table->integer('lead_time')->nullable();
            $table->enum('status', ['in-stock', 'low-stock', 'out-of-stock', 'over-stock'])->default('in-stock');
            $table->boolean('active')->default(true);
            $table->text('notes')->nullable();
            $table->integer('popularity')->default(0);
            $table->date('last_updated')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('product_id');
            $table->index('category');
            $table->index('status');
        });
    }

    public function down()
    {
        Schema::dropIfExists('products');
    }
};
