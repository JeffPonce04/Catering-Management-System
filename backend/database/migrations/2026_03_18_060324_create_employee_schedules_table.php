<?php
// database/migrations/2024_01_01_000006_create_employee_schedules_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_schedules', function (Blueprint $table) {
            $table->id();
            $table->string('schedule_id', 50)->unique();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->enum('shift_type', ['regular', 'oncall', 'overtime'])->default('regular');
            $table->enum('status', ['scheduled', 'completed', 'cancelled', 'no-show'])->default('scheduled');

            // Hours calculation
            $table->decimal('scheduled_hours', 5, 2);
            $table->decimal('actual_hours', 5, 2)->nullable();
            $table->decimal('break_hours', 5, 2)->default(1);

            // Assignment details
            $table->string('assigned_area', 255)->nullable();
            $table->string('supervisor', 100)->nullable();
            $table->json('tasks')->nullable();

            // Notes
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'date']);
            $table->index('status');
            $table->index('schedule_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_schedules');
    }
};
