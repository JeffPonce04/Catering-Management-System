<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Add country_code if it doesn't exist
            if (!Schema::hasColumn('users', 'country_code')) {
                $table->string('country_code')->default('+63')->after('phone_number');
            }

            // Add other fields if they don't exist
            if (!Schema::hasColumn('users', 'user_id')) {
                $table->string('user_id')->unique()->after('id');
            }

            if (!Schema::hasColumn('users', 'full_name')) {
                $table->string('full_name')->after('user_id');
            }

            if (!Schema::hasColumn('users', 'is_verified')) {
                $table->boolean('is_verified')->default(false)->after('password');
            }

            if (!Schema::hasColumn('users', 'phone_verified_at')) {
                $table->timestamp('phone_verified_at')->nullable()->after('is_verified');
            }

            if (!Schema::hasColumn('users', 'email_verified_at')) {
                $table->timestamp('email_verified_at')->nullable();
            }

            if (!Schema::hasColumn('users', 'profile_photo')) {
                $table->string('profile_photo')->nullable()->after('email_verified_at');
            }

            if (!Schema::hasColumn('users', 'status')) {
                $table->enum('status', ['active', 'inactive', 'suspended'])->default('active')->after('profile_photo');
            }

            if (!Schema::hasColumn('users', 'deleted_at')) {
                $table->softDeletes();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'country_code',
                'user_id',
                'full_name',
                'is_verified',
                'phone_verified_at',
                'profile_photo',
                'status'
            ]);

            $table->dropSoftDeletes();
        });
    }
};
