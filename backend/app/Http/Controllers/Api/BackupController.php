<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\BackupLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BackupController extends Controller
{
    public function index()
    {
        return response()->json(BackupLog::latest()->limit(50)->get());
    }

    public function store(Request $request)
    {
        $tables = [
            'roles', 'permissions', 'users', 'categories', 'products', 'tables',
            'transactions', 'transaction_details', 'payments', 'timers', 'reminders',
            'table_histories', 'cashier_shifts', 'activity_logs',
        ];

        $filename = 'pos-billing-backup-'.now()->format('Ymd-His').'.sql';
        $path = 'backups/'.$filename;
        $sql = "-- POS BILLING backup ".now()->toDateTimeString()."\nSET FOREIGN_KEY_CHECKS=0;\n";

        foreach ($tables as $table) {
            if (! DB::getSchemaBuilder()->hasTable($table)) {
                continue;
            }

            $rows = DB::table($table)->get();
            $sql .= "\nTRUNCATE TABLE `{$table}`;\n";
            foreach ($rows as $row) {
                $values = collect((array) $row)->map(fn ($value) => $value === null ? 'NULL' : DB::getPdo()->quote((string) $value))->implode(', ');
                $columns = collect(array_keys((array) $row))->map(fn ($column) => "`{$column}`")->implode(', ');
                $sql .= "INSERT INTO `{$table}` ({$columns}) VALUES ({$values});\n";
            }
        }

        $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
        Storage::disk('local')->put($path, $sql);

        $fullPath = Storage::disk('local')->path($path);
        $log = BackupLog::create([
            'user_id' => $request->user()?->id,
            'filename' => $filename,
            'path' => $fullPath,
            'size_bytes' => filesize($fullPath) ?: 0,
        ]);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'Backup database',
            'module' => 'Backup',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['path' => $fullPath],
        ]);

        return response()->json($log, 201);
    }
}
