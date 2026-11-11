<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    protected $table = 'chat_messages';
    protected $primaryKey = 'message_id';
    protected $guarded = [];

    protected $casts = [
        'read_at'                 => 'datetime',
        'deleted_at'              => 'datetime',
        'pinned_at'               => 'datetime',
        'is_deleted_for_everyone' => 'boolean',
        'is_pinned'               => 'boolean',
    ];

    /**
     * ⭐ REQUEST 2.1 — Thread relationship. Messages are persisted to the
     * database FIRST (source of truth), then broadcast via Reverb.
     */
    public function thread()
    {
        return $this->belongsTo(ChatThread::class, 'thread_id', 'thread_id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_user_id', 'user_id');
    }

    /**
     * ⭐ REQUEST 2.10 — Attachment metadata for this message.
     * Required by CustomerController::sendMessage() which calls
     * ->load(['sender.person', 'attachments']) before returning.
     */
    public function attachments()
    {
        return $this->hasMany(ChatAttachment::class, 'message_id', 'message_id');
    }
}
