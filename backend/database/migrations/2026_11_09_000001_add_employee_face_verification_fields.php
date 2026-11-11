<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            if (! Schema::hasColumn('employees', 'face_photo')) {
                $table->string('face_photo')->nullable();
            }
            if (! Schema::hasColumn('employees', 'face_consent_at')) {
                $table->timestamp('face_consent_at')->nullable();
            }
        });

        Schema::table('attendance_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('attendance_logs', 'time_in_face_status')) {
                $table->string('time_in_face_status', 24)->nullable();
            }
            if (! Schema::hasColumn('attendance_logs', 'time_out_face_status')) {
                $table->string('time_out_face_status', 24)->nullable();
            }
            if (! Schema::hasColumn('attendance_logs', 'time_in_face_confidence')) {
                $table->decimal('time_in_face_confidence', 8, 5)->nullable();
            }
            if (! Schema::hasColumn('attendance_logs', 'time_out_face_confidence')) {
                $table->decimal('time_out_face_confidence', 8, 5)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('attendance_logs', function (Blueprint $table) {
            foreach (['time_in_face_status', 'time_out_face_status', 'time_in_face_confidence', 'time_out_face_confidence'] as $column) {
                if (Schema::hasColumn('attendance_logs', $column)) $table->dropColumn($column);
            }
        });
        Schema::table('employees', function (Blueprint $table) {
            foreach (['face_photo', 'face_consent_at'] as $column) {
                if (Schema::hasColumn('employees', $column)) $table->dropColumn($column);
            }
        });
    }
};
