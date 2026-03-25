<?php
// database/migrations/2024_01_01_000009_create_employee_performance_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_performance', function (Blueprint $table) {
            $table->id();
            $table->string('performance_id', 50)->unique();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->date('review_date');
            $table->enum('review_period', ['monthly', 'quarterly', 'yearly'])->default('quarterly');

            // Performance metrics
            $table->integer('attendance_score')->default(0);
            $table->integer('productivity_score')->default(0);
            $table->integer('quality_score')->default(0);
            $table->integer('teamwork_score')->default(0);
            $table->integer('customer_feedback_score')->default(0);
            $table->integer('overall_score')->default(0);

            // Review details
            $table->text('strengths')->nullable();
            $table->text('areas_for_improvement')->nullable();
            $table->text('comments')->nullable();
            $table->json('achievements')->nullable();
            $table->json('goals')->nullable();

            // Reviewer
            $table->foreignId('reviewed_by')->nullable()->constrained('employees');
            $table->enum('status', ['draft', 'submitted', 'acknowledged'])->default('draft');

            $table->timestamps();

            $table->index(['employee_id', 'review_date']);
            $table->index('performance_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_performance');
    }
};
