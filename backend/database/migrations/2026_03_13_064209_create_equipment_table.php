<?php
// database/migrations/2024_03_11_000002_create_equipment_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('equipment', function (Blueprint $table) {
            $table->id();
            $table->string('equipment_id')->unique();
            $table->string('name');
            $table->string('model')->nullable();
            $table->string('serial_number')->nullable();
            $table->string('category');
            $table->string('sub_category')->nullable();
            $table->integer('total_quantity')->default(0);
            $table->integer('in_use')->default(0);
            $table->integer('available')->default(0);
            $table->integer('damaged')->default(0);
            $table->integer('missing')->default(0);
            $table->integer('under_maintenance')->default(0);
            $table->string('location')->nullable();
            $table->string('supplier')->nullable();
            $table->date('last_maintenance')->nullable();
            $table->date('next_maintenance')->nullable();
            $table->enum('condition', ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged'])->default('Good');
            $table->enum('status', ['available', 'in-use', 'maintenance', 'damaged', 'retired'])->default('available');
            $table->boolean('active')->default(true);
            $table->text('notes')->nullable();
            $table->integer('usage_count')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index('equipment_id');
            $table->index('category');
            $table->index('status');
            $table->index('condition');
        });
    }

    public function down()
    {
        Schema::dropIfExists('equipment');
    }
};
