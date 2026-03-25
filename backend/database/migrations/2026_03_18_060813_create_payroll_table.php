<?php
// database/migrations/2024_01_01_000008_create_payroll_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('payroll', function (Blueprint $table) {
            $table->id();
            $table->string('payroll_id', 50)->unique();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->foreignId('payroll_period_id')->constrained('payroll_periods')->onDelete('cascade');

            // Hours worked
            $table->decimal('regular_hours', 8, 2)->default(0);
            $table->decimal('overtime_hours', 8, 2)->default(0);
            $table->decimal('holiday_hours', 8, 2)->default(0);
            $table->decimal('late_hours', 8, 2)->default(0);
            $table->decimal('total_hours', 8, 2)->default(0);

            // Earnings
            $table->decimal('base_pay', 10, 2)->default(0);
            $table->decimal('overtime_pay', 10, 2)->default(0);
            $table->decimal('holiday_pay', 10, 2)->default(0);
            $table->decimal('allowances', 10, 2)->default(0);
            $table->decimal('bonuses', 10, 2)->default(0);
            $table->decimal('gross_pay', 10, 2)->default(0);

            // Deductions
            $table->decimal('tax', 10, 2)->default(0);
            $table->decimal('sss', 10, 2)->default(0);
            $table->decimal('philhealth', 10, 2)->default(0);
            $table->decimal('pagibig', 10, 2)->default(0);
            $table->decimal('late_deductions', 10, 2)->default(0);
            $table->decimal('other_deductions', 10, 2)->default(0);
            $table->decimal('total_deductions', 10, 2)->default(0);

            // Net pay
            $table->decimal('net_pay', 10, 2)->default(0);

            // Payment details
            $table->enum('payment_method', ['bank_transfer', 'cash', 'check'])->default('bank_transfer');
            $table->string('bank_name', 100)->nullable();
            $table->string('bank_account', 50)->nullable();
            $table->string('check_number', 50)->nullable();
            $table->date('payment_date')->nullable();
            $table->enum('status', ['pending', 'processed', 'paid', 'cancelled'])->default('pending');

            // System fields
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'payroll_period_id']);
            $table->index('payroll_period_id');
            $table->index('status');
            $table->index('payroll_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('payroll');
    }
};
