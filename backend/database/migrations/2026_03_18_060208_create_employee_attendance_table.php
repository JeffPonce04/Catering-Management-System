<?php
// database/migrations/2024_01_01_000004_create_employee_attendance_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_attendance', function (Blueprint $table) {
            $table->id();
            $table->string('attendance_id', 50)->unique();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->date('date');
            $table->enum('shift', ['morning', 'afternoon', 'evening', 'night'])->default('morning');

            // Check in/out times
            $table->time('check_in')->nullable();
            $table->time('check_out')->nullable();
            $table->decimal('total_hours', 5, 2)->default(0);
            $table->decimal('overtime_hours', 5, 2)->default(0);
            $table->integer('late_minutes')->default(0);
            $table->integer('early_leave_minutes')->default(0);

            // Selfie verification
            $table->string('check_in_selfie')->nullable();
            $table->string('check_out_selfie')->nullable();
            $table->json('location_data')->nullable();

            // Status
            $table->enum('status', ['present', 'absent', 'late', 'half-day', 'on-leave'])->default('present');
            $table->enum('attendance_type', ['regular', 'overtime', 'holiday', 'sick', 'vacation'])->default('regular');

            // System fields
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'date']);
            $table->index('date');
            $table->index('status');
            $table->index('attendance_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_attendance');
    }
};
