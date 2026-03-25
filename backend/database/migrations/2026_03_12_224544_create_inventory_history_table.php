<?php
// database/migrations/2024_03_11_000003_create_inventory_history_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('inventory_history', function (Blueprint $table) {
            $table->id();
            $table->morphs('trackable'); // Creates trackable_id and trackable_type
            $table->string('item_name');
            $table->enum('type', ['in', 'out', 'adjustment', 'maintenance', 'damaged', 'missing']);
            $table->integer('quantity');
            $table->string('unit')->nullable();
            $table->datetime('date');
            $table->string('reason')->nullable();
            $table->string('performed_by');
            $table->string('event_id')->nullable();
            $table->string('event_name')->nullable();
            $table->integer('damaged')->default(0);
            $table->integer('missing')->default(0);
            $table->json('details')->nullable(); // For additional data
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['trackable_id', 'trackable_type']);
            $table->index('event_id');
            $table->index('date');
        });
    }

    public function down()
    {
        Schema::dropIfExists('inventory_history');
    }
};
