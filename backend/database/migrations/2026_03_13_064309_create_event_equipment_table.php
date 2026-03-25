<?php
// database/migrations/2024_03_11_000005_create_event_equipment_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('event_equipment', function (Blueprint $table) {
            $table->id();
            $table->string('event_id');
            $table->string('equipment_id');
            $table->integer('quantity_out');
            $table->integer('quantity_returned')->default(0);
            $table->integer('damaged')->default(0);
            $table->integer('missing')->default(0);
            $table->enum('status', ['out', 'partial', 'returned'])->default('out');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('event_id')->references('event_id')->on('events')->onDelete('cascade');
            $table->foreign('equipment_id')->references('equipment_id')->on('equipment')->onDelete('cascade');
            $table->index(['event_id', 'equipment_id']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('event_equipment');
    }
};
