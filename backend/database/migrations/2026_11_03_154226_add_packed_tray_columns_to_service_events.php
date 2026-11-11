<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('service_events', function (Blueprint $table) {
            if (! Schema::hasColumn('service_events', 'delivery_completed_at')) {
                $table->dateTime('delivery_completed_at')->nullable()->after('status');
            }
            if (! Schema::hasColumn('service_events', 'pickup_completed_at')) {
                $table->dateTime('pickup_completed_at')->nullable()->after('delivery_completed_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('service_events', function (Blueprint $table) {
            if (Schema::hasColumn('service_events', 'delivery_completed_at')) {
                $table->dropColumn('delivery_completed_at');
            }
            if (Schema::hasColumn('service_events', 'pickup_completed_at')) {
                $table->dropColumn('pickup_completed_at');
            }
        });
    }
};
