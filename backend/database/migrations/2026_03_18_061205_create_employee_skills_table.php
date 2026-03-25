<?php
// database/migrations/2024_01_01_000011_create_employee_skills_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->string('skill_name', 100);
            $table->enum('proficiency', ['beginner', 'intermediate', 'advanced', 'expert'])->default('intermediate');
            $table->integer('years_experience')->default(0);
            $table->boolean('is_certified')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'skill_name']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_skills');
    }
};
