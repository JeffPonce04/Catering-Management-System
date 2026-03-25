<?php
// database/migrations/2024_01_01_000011_create_employee_training_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_training', function (Blueprint $table) {
            $table->id();
            $table->string('training_id')->unique();
            $table->string('training_name');
            $table->text('description')->nullable();
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->integer('duration_hours')->nullable();
            $table->string('provider')->nullable();
            $table->string('location')->nullable();
            $table->enum('status', ['planned', 'ongoing', 'completed', 'cancelled'])->default('planned');
            $table->json('participants')->nullable(); // Array of employee IDs
            $table->json('trainers')->nullable();
            $table->json('materials')->nullable();
            $table->text('notes')->nullable();
            $table->json('certificates')->nullable();
            $table->timestamps();

            $table->index(['start_date', 'status']);
            $table->index('training_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_training');
    }
};
