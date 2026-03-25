<?php
// database/migrations/2024_01_01_000003_create_employees_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->string('employee_id', 50)->unique();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('middle_name', 100)->nullable();
            $table->string('email', 100)->unique();
            $table->string('phone', 20)->unique();
            $table->string('emergency_phone', 20)->nullable();
            $table->string('emergency_contact', 100)->nullable();
            $table->string('emergency_relation', 50)->nullable();
            $table->text('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('country', 100)->default('Philippines');

            // Employment details
            $table->foreignId('department_id')->constrained();
            $table->foreignId('position_id')->constrained();
            $table->enum('employee_type', ['regular', 'oncall', 'probationary', 'contract'])->default('regular');
            $table->enum('status', ['active', 'inactive', 'onleave', 'terminated'])->default('active');
            $table->date('hire_date');
            $table->date('regularization_date')->nullable();
            $table->date('exit_date')->nullable();
            $table->string('exit_reason', 255)->nullable();

            // Personal details
            $table->date('birth_date')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->string('marital_status', 50)->nullable();
            $table->string('nationality', 100)->default('Filipino');
            $table->string('religion', 100)->nullable();

            // Government IDs
            $table->string('sss', 20)->nullable()->unique();
            $table->string('philhealth', 20)->nullable()->unique();
            $table->string('pagibig', 20)->nullable()->unique();
            $table->string('tin', 20)->nullable()->unique();

            // Bank details
            $table->string('bank_name', 100)->nullable();
            $table->string('bank_account', 50)->nullable();
            $table->string('bank_account_name', 100)->nullable();

            // Work details
            $table->enum('shift_preference', ['morning', 'afternoon', 'evening', 'night', 'flexible'])->default('morning');
            $table->json('availability')->nullable();
            $table->integer('max_hours_per_week')->nullable();
            $table->decimal('hourly_rate', 8, 2)->default(0);
            $table->decimal('monthly_salary', 10, 2)->default(0);

            // Profile
            $table->string('profile_photo')->nullable();
            $table->string('signature')->nullable();
            $table->json('documents')->nullable();

            // System fields
            $table->json('skills')->nullable();
            $table->json('certifications')->nullable();
            $table->json('achievements')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_bookmarked')->default(false);
            $table->timestamp('last_login')->nullable();
            $table->integer('login_count')->default(0);

            $table->timestamps();
            $table->softDeletes();

            $table->index('employee_id');
            $table->index('email');
            $table->index('phone');
            $table->index('status');
            $table->index('employee_type');
            $table->index('department_id');
            $table->index(['status', 'employee_type']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('employees');
    }
};
