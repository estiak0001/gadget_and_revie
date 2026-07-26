<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class UploadController extends BaseController
{
    /**
     * Upload a single file (image)
     *
     * POST /api/upload
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:10240', // 10MB max
            'directory' => 'nullable|string|max:100',
        ]);

        $file = $request->file('file');
        $directory = $request->get('directory', 'uploads');

        // Sanitize directory name
        $directory = preg_replace('/[^a-zA-Z0-9\-_\/]/', '', $directory);

        $path = $file->store($directory, 'public');

        $user = $request->user();
        if ($user) {
            AuditLog::log($user, 'upload_file', 'File', null, null, [
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
            ], 'File uploaded');
        }

        return $this->success([
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
            'original_name' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
        ], 'File uploaded successfully');
    }

    /**
     * Upload multiple files (images)
     *
     * POST /api/upload/multiple
     */
    public function uploadMultiple(Request $request): JsonResponse
    {
        $request->validate([
            'files' => 'required|array|min:1|max:10',
            'files.*' => 'file|max:10240', // 10MB max per file
            'directory' => 'nullable|string|max:100',
        ]);

        $directory = $request->get('directory', 'uploads');
        $directory = preg_replace('/[^a-zA-Z0-9\-_\/]/', '', $directory);

        $uploaded = [];

        foreach ($request->file('files') as $file) {
            $path = $file->store($directory, 'public');

            $uploaded[] = [
                'path' => $path,
                'url' => Storage::disk('public')->url($path),
                'original_name' => $file->getClientOriginalName(),
                'size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
            ];
        }

        $user = $request->user();
        if ($user) {
            AuditLog::log($user, 'upload_multiple_files', 'File', null, null, [
                'count' => count($uploaded),
                'paths' => array_column($uploaded, 'path'),
            ], count($uploaded) . ' files uploaded');
        }

        return $this->success([
            'files' => $uploaded,
            'count' => count($uploaded),
        ], 'Files uploaded successfully');
    }

    /**
     * Delete a previously uploaded file
     *
     * DELETE /api/upload
     */
    public function delete(Request $request): JsonResponse
    {
        $request->validate([
            'path' => 'required|string|max:500',
        ]);

        $path = $request->path;

        if (!Storage::disk('public')->exists($path)) {
            return $this->notFound('File not found');
        }

        Storage::disk('public')->delete($path);

        $user = $request->user();
        if ($user) {
            AuditLog::log($user, 'delete_file', 'File', null, [
                'path' => $path,
            ], null, 'File deleted');
        }

        return $this->success(null, 'File deleted successfully');
    }
}
