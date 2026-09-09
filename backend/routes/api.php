<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BackupController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PosStateController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\TableController;
use App\Http\Controllers\Api\TimerController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::get('health', fn () => response()->json([
    'status' => 'ok',
    'app' => config('app.name'),
    'time' => now()->toISOString(),
]));

Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::middleware('auth:api')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('refresh', [AuthController::class, 'refresh']);
        Route::post('users/{user}/reset-password', [AuthController::class, 'resetPassword'])->middleware('role:Super Admin');
    });
});

Route::middleware('auth:api')->group(function () {
    Route::get('pos/state', [PosStateController::class, 'state']);
    Route::post('pos/reset-operational', [PosStateController::class, 'resetOperational']);

    Route::apiResource('categories', CategoryController::class)->middleware('role:Super Admin,Admin');
    Route::apiResource('products', ProductController::class)->middleware('role:Super Admin,Admin');
    Route::post('products/{product}/upload', [ProductController::class, 'upload'])->middleware('role:Super Admin,Admin');
    Route::apiResource('users', UserController::class)->middleware('role:Super Admin');

    Route::apiResource('tables', TableController::class);
    Route::patch('tables/{table}/position', [TableController::class, 'updatePosition']);

    Route::apiResource('timers', TimerController::class);
    Route::post('timers/{timer}/acknowledge', [TimerController::class, 'acknowledge']);
    Route::post('timers/{timer}/expire', [TimerController::class, 'expire']);
    Route::post('timers/{timer}/finish', [TimerController::class, 'finish']);
    // Extend gratis (tanpa pembayaran) hanya untuk Super Admin — mis. kompensasi/komplain.
    // Perpanjangan gratis hanya untuk Super Admin; kasir menentukan durasi saat membuka sesi baru.
    Route::post('timers/{timer}/extend', [TimerController::class, 'extend'])->middleware('role:Super Admin');

    Route::post('transactions/open-order', [TransactionController::class, 'openOrder']);
    Route::post('transactions/cancel-order', [TransactionController::class, 'cancelOrder']);
    Route::apiResource('transactions', TransactionController::class);
    Route::post('transactions/checkout', [TransactionController::class, 'checkout']);
    Route::post('transactions/{transaction}/void', [TransactionController::class, 'voidTransaction'])->middleware('role:Super Admin');
    Route::post('transactions/{transaction}/refund', [TransactionController::class, 'refund'])->middleware('role:Super Admin,Admin');

    Route::get('shifts', [ShiftController::class, 'index']);
    Route::post('shifts/open', [ShiftController::class, 'open']);
    Route::post('shifts/{shift}/close', [ShiftController::class, 'close']);

    Route::get('backups', [BackupController::class, 'index'])->middleware('role:Super Admin');
    Route::post('backups', [BackupController::class, 'store'])->middleware('role:Super Admin');

    Route::get('reports/summary', [ReportController::class, 'summary']);
    Route::get('reports/export/{type}', [ReportController::class, 'export']);
});
