<?php
// database/migrations/2024_01_01_000012_create_employee_certifications_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_certifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->string('certification_name', 255);
            $table->string('issuing_organization', 255);
            $table->date('issue_date');
            $table->date('expiry_date')->nullable();
            $table->string('credential_id', 100)->nullable();
            $table->string('credential_url', 255)->nullable();
            $table->boolean('is_verified')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'expiry_date']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_certifications');
    }
};
