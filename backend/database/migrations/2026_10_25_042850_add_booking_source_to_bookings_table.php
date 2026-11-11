<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            // ⭐ Where the booking came from.
            //    'walk_in'  → created by admin/cashier at the front desk
            //    'mobile'   → created by the customer through the mobile app
            //    'web'      → created by the customer through the public website
            //    'phone'    → created by admin on behalf of a phone caller
            $table->string('booking_source', 30)
                ->default('walk_in')
                ->after('booking_status')
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['booking_source']);
            $table->dropColumn('booking_source');
        });
    }
};
