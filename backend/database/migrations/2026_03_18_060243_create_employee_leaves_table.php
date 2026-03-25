<?php
// database/migrations/2024_01_01_000005_create_employee_leaves_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_leaves', function (Blueprint $table) {
            $table->id();
            $table->string('leave_id', 50)->unique();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->enum('leave_type', ['vacation', 'sick', 'emergency', 'maternity', 'paternity', 'bereavement', 'unpaid']);
            $table->date('start_date');
            $table->date('end_date');
            $table->integer('total_days');
            $table->text('reason');
            $table->string('document')->nullable();

            // Status workflow
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users');
            $table->text('rejection_reason')->nullable();

            // System fields
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'status']);
            $table->index('start_date');
            $table->index('leave_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_leaves');
    }
};
