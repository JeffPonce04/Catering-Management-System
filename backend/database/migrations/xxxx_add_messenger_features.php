<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // ⭐ REQUEST 2.1 — delivery status.
        Schema::table('chat_messages', function (Blueprint $t) {
            $t->string('delivery_status', 16)->default('sent')->after('read_at');
            $t->boolean('is_deleted_for_everyone')->default(false)->after('delivery_status');
            $t->timestamp('deleted_at')->nullable()->after('is_deleted_for_everyone');
            $t->boolean('is_pinned')->default(false)->after('deleted_at');
            $t->timestamp('pinned_at')->nullable()->after('is_pinned');
        });

        // ⭐ REQUEST 2.4 — archive flag.
        Schema::table('chat_threads', function (Blueprint $t) {
            $t->boolean('is_archived')->default(false)->after('status');
            $t->timestamp('archived_at')->nullable()->after('is_archived');
        });

        // ⭐ REQUEST 2.4 — block flag.
        Schema::table('customers', function (Blueprint $t) {
            $t->boolean('is_messaging_blocked')->default(false)->after('is_active');
        });

        // ⭐ REQUEST 2.5 — per-user "delete for me".
        Schema::create('chat_message_deletions', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('message_id');
            $t->unsignedBigInteger('user_id');
            $t->timestamps();
            $t->unique(['message_id', 'user_id']);
        });

        // ⭐ REQUEST 2.10 — attachments metadata.
        Schema::create('chat_attachments', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('message_id');
            $t->unsignedBigInteger('thread_id');
            $t->string('file_name');
            $t->string('file_path');
            $t->string('mime_type', 120);
            $t->unsignedBigInteger('file_size');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_attachments');
        Schema::dropIfExists('chat_message_deletions');
        Schema::table('customers', fn(Blueprint $t) => $t->dropColumn('is_messaging_blocked'));
        Schema::table('chat_threads', fn(Blueprint $t) => $t->dropColumn(['is_archived', 'archived_at']));
        Schema::table('chat_messages', fn(Blueprint $t) => $t->dropColumn([
            'delivery_status',
            'is_deleted_for_everyone',
            'deleted_at',
            'is_pinned',
            'pinned_at',
        ]));
    }
};
