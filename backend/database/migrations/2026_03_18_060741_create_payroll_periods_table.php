<?php
// database/migrations/2024_01_01_000007_create_payroll_periods_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('payroll_periods', function (Blueprint $table) {
            $table->id();
            $table->string('period_id', 50)->unique();
            $table->string('name', 100);
            $table->date('start_date');
            $table->date('end_date');
            $table->date('cutoff_date');
            $table->date('payment_date');
            $table->enum('status', ['draft', 'processing', 'completed', 'cancelled'])->default('draft');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['start_date', 'end_date']);
            $table->index('status');
            $table->index('period_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('payroll_periods');
    }
};
