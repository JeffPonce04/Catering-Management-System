<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            if (!Schema::hasColumn('inventory_movements', 'purchased_by_name')) {
                $table->string('purchased_by_name')->nullable()->after('performed_by');
            }
            if (!Schema::hasColumn('inventory_movements', 'delivered_by')) {
                $table->string('delivered_by')->nullable()->after('purchased_by_name');
            }
            if (!Schema::hasColumn('inventory_movements', 'received_by')) {
                $table->string('received_by')->nullable()->after('delivered_by');
            }
            if (!Schema::hasColumn('inventory_movements', 'supplier_name')) {
                $table->string('supplier_name')->nullable()->after('received_by');
            }
            if (!Schema::hasColumn('inventory_movements', 'reference_number')) {
                $table->string('reference_number')->nullable()->after('supplier_name');
            }
        });

        Schema::table('purchase_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('purchase_requests', 'delivered_by')) {
                $table->string('delivered_by')->nullable()->after('notes');
            }
            if (!Schema::hasColumn('purchase_requests', 'received_by')) {
                $table->string('received_by')->nullable()->after('delivered_by');
            }
            if (!Schema::hasColumn('purchase_requests', 'received_at')) {
                $table->timestamp('received_at')->nullable()->after('received_by');
            }
            if (!Schema::hasColumn('purchase_requests', 'reference_number')) {
                $table->string('reference_number')->nullable()->after('received_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropColumn(['purchased_by_name', 'delivered_by', 'received_by', 'supplier_name', 'reference_number']);
        });
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->dropColumn(['delivered_by', 'received_by', 'received_at', 'reference_number']);
        });
    }
};
