<?php
// app/Models/EmployeeDocument.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeDocument extends Model
{
    use HasFactory;

    protected $table = 'employee_documents';

    protected $fillable = [
        'document_id',
        'employee_id',
        'document_type',
        'document_name',
        'file_path',
        'file_size',
        'mime_type',
        'expiry_date',
        'is_verified',
        'notes',
        'metadata'
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'is_verified' => 'boolean',
        'metadata' => 'array'
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function getIsExpiredAttribute()
    {
        return $this->expiry_date && $this->expiry_date < now();
    }

    public function getFileUrlAttribute()
    {
        return asset('storage/' . $this->file_path);
    }
}
