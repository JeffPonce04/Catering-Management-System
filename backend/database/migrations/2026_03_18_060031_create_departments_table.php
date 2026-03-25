<?php
// database/migrations/2024_01_01_000001_create_departments_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('department_id', 50)->unique();
            $table->string('name', 100);
            $table->string('code', 20)->unique();
            $table->text('description')->nullable();
            $table->string('head_position', 100)->nullable();
            $table->integer('employee_count')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index('department_id');
            $table->index('code');
            $table->index('name');
        });
    }

    public function down()
    {
        Schema::dropIfExists('departments');
    }
};
