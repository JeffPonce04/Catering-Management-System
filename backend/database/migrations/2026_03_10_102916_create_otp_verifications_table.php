<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('otp_verifications', function (Blueprint $table) {
            $table->id();
            $table->string('phone_number');
            $table->string('country_code')->default('+63');
            $table->string('otp_code', 6);
            $table->enum('type', ['registration', 'login', 'password_reset'])->default('registration');
            $table->enum('status', ['pending', 'verified', 'expired'])->default('pending');
            $table->integer('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index(['phone_number', 'otp_code', 'status']);
            $table->index(['created_at', 'expires_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('otp_verifications');
    }
};
