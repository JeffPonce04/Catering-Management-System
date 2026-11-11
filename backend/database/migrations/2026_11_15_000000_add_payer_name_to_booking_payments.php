<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_payments', function (Blueprint $table) {
            // ⭐ Person who physically handed over the payment.
            //    Nullable → legacy rows keep working, fallback applied at read time.
            $table->string('payer_name', 150)->nullable()->after('amount');

            // ⭐ Relationship to the booked customer (Brother, Driver, Sponsor…)
            $table->string('payer_relation', 100)->nullable()->after('payer_name');

            $table->index('payer_name');
        });
    }

    public function down(): void
    {
        Schema::table('booking_payments', function (Blueprint $table) {
            $table->dropIndex(['payer_name']);
            $table->dropColumn(['payer_name', 'payer_relation']);
        });
    }
};
