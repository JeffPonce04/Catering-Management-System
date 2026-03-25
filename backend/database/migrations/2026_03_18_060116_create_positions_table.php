<?php
// database/migrations/2024_01_01_000002_create_positions_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('positions', function (Blueprint $table) {
            $table->id();
            $table->string('position_id', 50)->unique();
            $table->string('title', 100);
            $table->foreignId('department_id')->constrained()->onDelete('cascade');
            $table->text('description')->nullable();
            $table->json('responsibilities')->nullable();
            $table->json('requirements')->nullable();
            $table->decimal('base_salary', 10, 2)->default(0);
            $table->decimal('hourly_rate', 8, 2)->default(0);
            $table->enum('employment_type', ['full-time', 'part-time', 'contract', 'internship'])->default('full-time');
            $table->integer('max_hours_per_week')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('position_id');
            $table->index('title');
        });
    }

    public function down()
    {
        Schema::dropIfExists('positions');
    }
};
