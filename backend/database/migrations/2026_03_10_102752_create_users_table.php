<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('user_id')->unique();
            $table->string('full_name');
            $table->string('email')->unique();
            $table->string('phone_number')->unique();
            $table->string('country_code')->default('+63');
            $table->string('password');
            $table->boolean('is_verified')->default(false);
            $table->timestamp('phone_verified_at')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('profile_photo')->nullable();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->string('remember_token')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'email', 'phone_number']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('users');
    }
};
