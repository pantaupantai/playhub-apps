<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/storage/{path}', function (string $path) {
    $storageRoot = realpath(storage_path('app/public'));
    $file = realpath(storage_path('app/public/'.$path));

    abort_unless(
        $storageRoot !== false
        && $file !== false
        && str_starts_with($file, $storageRoot.DIRECTORY_SEPARATOR)
        && is_file($file),
        404,
    );

    return response()->file($file);
})->where('path', '.*');

Route::fallback(function (Request $request) {
    if ($request->is('api') || $request->is('api/*')) {
        return response()->json(['message' => 'Endpoint API tidak ditemukan.'], 404);
    }

    return response()->file(public_path('index.html'));
});
