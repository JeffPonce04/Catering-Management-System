<?php
// database/migrations/2024_03_11_000004_create_events_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->string('event_id')->unique();
            $table->string('name');
            $table->string('location');
            $table->datetime('date_out');
            $table->datetime('expected_date_in');
            $table->datetime('actual_date_in')->nullable();
            $table->string('person_responsible');
            $table->string('contact_number')->nullable();
            $table->text('notes')->nullable();
            $table->enum('status', ['ongoing', 'upcoming', 'completed', 'overdue'])->default('upcoming');
            $table->timestamps();

            $table->index('event_id');
            $table->index('status');
            $table->index('date_out');
        });
    }

    public function down()
    {
        Schema::dropIfExists('events');
    }
};
