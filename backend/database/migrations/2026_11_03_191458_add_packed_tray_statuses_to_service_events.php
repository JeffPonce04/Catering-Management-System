<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ⭐ Extend the enum to include the packed/tray lifecycle statuses.
        //    This is REQUIRED — the backend writes these values when the
        //    last meal of a Packed or Tray booking is completed.
        DB::statement("ALTER TABLE `service_events` MODIFY COLUMN `status` ENUM(
            'pending',
            'confirmed',
            'ongoing',
            'completed',
            'cancelled',
            'done_deliver',
            'done_pickup',
            'missed_delivery',
            'missed_pickup'
        ) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        // ⭐ Rollback: revert to the original 5 statuses.
        //    Any rows currently on the removed statuses will be reset to 'confirmed'.
        DB::statement("UPDATE `service_events` SET `status` = 'confirmed'
            WHERE `status` IN ('done_deliver','done_pickup','missed_delivery','missed_pickup')");

        DB::statement("ALTER TABLE `service_events` MODIFY COLUMN `status` ENUM(
            'pending',
            'confirmed',
            'ongoing',
            'completed',
            'cancelled'
        ) NOT NULL DEFAULT 'pending'");
    }
};
