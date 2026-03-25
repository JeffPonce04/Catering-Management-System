<?php
// database/migrations/2024_01_01_000013_create_employee_emergency_contacts_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_emergency_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->string('contact_name', 100);
            $table->string('relationship', 50);
            $table->string('phone', 20);
            $table->string('alternative_phone', 20)->nullable();
            $table->string('email', 100)->nullable();
            $table->text('address')->nullable();
            $table->boolean('is_primary')->default(false);
            $table->timestamps();

            $table->index(['employee_id', 'is_primary']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_emergency_contacts');
    }
};
