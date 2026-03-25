<?php
// app/Http/Controllers/Staff/DocumentController.php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Models\EmployeeDocument;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    /**
     * Get documents by employee
     */
    public function getByEmployee($employeeId)
    {
        $employee = Employee::where('id', $employeeId)->orWhere('employee_id', $employeeId)->first();

        if (!$employee) {
            return response()->json([
                'success' => false,
                'message' => 'Employee not found'
            ], 404);
        }

        $documents = EmployeeDocument::where('employee_id', $employee->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $documents
        ]);
    }

    /**
     * Upload a document
     */
    public function upload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'employee_id' => 'required|exists:employees,id',
            'document_type' => 'required|in:resume,contract,id,certification,training,performance_review,disciplinary,medical,other',
            'document_name' => 'required|string|max:255',
            'file' => 'required|file|mimes:pdf,doc,docx,jpg,jpeg,png|max:10240', // 10MB max
            'expiry_date' => 'nullable|date',
            'notes' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Upload file
        $file = $request->file('file');
        $path = $file->store('employee-documents/' . $request->employee_id, 'public');
        $fileSize = $file->getSize();
        $mimeType = $file->getMimeType();

        $document = EmployeeDocument::create([
            'document_id' => 'DOC-' . strtoupper(uniqid()),
            'employee_id' => $request->employee_id,
            'document_type' => $request->document_type,
            'document_name' => $request->document_name,
            'file_path' => $path,
            'file_size' => $fileSize,
            'mime_type' => $mimeType,
            'expiry_date' => $request->expiry_date,
            'is_verified' => false,
            'notes' => $request->notes
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Document uploaded successfully',
            'data' => $document
        ], 201);
    }

    /**
     * Download a document
     */
    public function download($id)
    {
        $document = EmployeeDocument::where('id', $id)->orWhere('document_id', $id)->first();

        if (!$document) {
            return response()->json([
                'success' => false,
                'message' => 'Document not found'
            ], 404);
        }

        if (!Storage::disk('public')->exists($document->file_path)) {
            return response()->json([
                'success' => false,
                'message' => 'File not found'
            ], 404);
        }

        return Storage::disk('public')->download($document->file_path, $document->document_name);
    }

    /**
     * Delete a document
     */
    public function destroy($id)
    {
        $document = EmployeeDocument::where('id', $id)->orWhere('document_id', $id)->first();

        if (!$document) {
            return response()->json([
                'success' => false,
                'message' => 'Document not found'
            ], 404);
        }

        // Delete file from storage
        if (Storage::disk('public')->exists($document->file_path)) {
            Storage::disk('public')->delete($document->file_path);
        }

        $document->delete();

        return response()->json([
            'success' => true,
            'message' => 'Document deleted successfully'
        ]);
    }
}
