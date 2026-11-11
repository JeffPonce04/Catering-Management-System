<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatAttachment extends Model
{
    protected $table = 'chat_attachments';
    protected $primaryKey = 'id';
    protected $guarded = [];

    protected $casts = [
        'file_size' => 'integer',
    ];

    // So the API response matches the shape the frontend expects:
    // { name, kind: 'image'|'video'|'file', url, ... }
    protected $appends = ['name', 'kind', 'url'];

    public function message()
    {
        return $this->belongsTo(ChatMessage::class, 'message_id', 'message_id');
    }

    public function thread()
    {
        return $this->belongsTo(ChatThread::class, 'thread_id', 'thread_id');
    }

    public function getNameAttribute()
    {
        return $this->file_name;
    }

    public function getKindAttribute()
    {
        $mime = strtolower((string) $this->mime_type);

        if (str_starts_with($mime, 'image/')) return 'image';
        if (str_starts_with($mime, 'video/')) return 'video';

        return 'file';
    }

    public function getUrlAttribute()
    {
        // Served through an authorized route so only thread participants
        // can download it.
        return url("/api/v1/customer-messages/attachments/{$this->id}");
    }
}
