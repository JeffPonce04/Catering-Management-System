<?php
// database/migrations/2024_01_01_000010_create_employee_documents_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('employee_documents', function (Blueprint $table) {
            $table->id();
            $table->string('document_id', 50)->unique();
            $table->foreignId('employee_id')->constrained()->onDelete('cascade');
            $table->enum('document_type', [
                'resume',
                'contract',
                'id',
                'certification',
                'training',
                'performance_review',
                'disciplinary',
                'medical',
                'other'
            ]);
            $table->string('document_name', 255);
            $table->string('file_path', 255);
            $table->string('file_size', 20)->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->date('expiry_date')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'document_type']);
            $table->index('document_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('employee_documents');
    }
};
