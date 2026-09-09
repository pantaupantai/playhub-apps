<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Category;
use App\Models\BackupLog;
use App\Models\CashierShift;
use App\Models\LoungeTable;
use App\Models\Product;
use App\Models\TableHistory;
use App\Models\Timer;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PosStateController extends Controller
{
    public function state()
    {
        return response()->json([
            'users' => User::with('role')->orderBy('id')->get(),
            'categories' => Category::orderBy('name')->get(),
            'products' => Product::orderBy('name')->get(),
            'tables' => LoungeTable::orderBy('id')->get(),
            'transactions' => Transaction::with([
                'details:id,transaction_id,product_id,qty,discount',
                'payments:id,transaction_id,method',
            ])
                ->where('status', 'paid')
                ->latest()
                ->limit(500)
                ->get(),
            'open_orders' => Transaction::with([
                'details:id,transaction_id,product_id,qty,discount',
            ])
                ->whereIn('status', ['open', 'hold'])
                ->latest()
                ->get(),
            'timers' => Timer::with('reminder')->whereIn('status', ['running', 'expired'])->latest()->get(),
            'table_histories' => TableHistory::with([
                'transaction.details.product:id,name,sku',
            ])->latest()->limit(300)->get(),
            'cashier_shifts' => CashierShift::latest()->limit(100)->get(),
            'backup_logs' => BackupLog::latest()->limit(50)->get(),
            'activity_logs' => ActivityLog::latest()->limit(100)->get(),
            'server_time' => now()->toISOString(),
        ]);
    }

    public function resetOperational(Request $request)
    {
        abort_unless($request->user()?->role?->name === 'Super Admin', 403, 'Hanya Super Admin yang dapat reset data operasional.');

        DB::transaction(function () use ($request) {
            DB::table('reminders')->delete();
            Timer::query()->delete();
            DB::table('payments')->delete();
            DB::table('transaction_details')->delete();
            DB::table('table_histories')->delete();
            Transaction::query()->delete();
            LoungeTable::query()->update(['status' => 'available']);

            ActivityLog::create([
                'user_id' => $request->user()->id,
                'action' => 'Reset data operasional',
                'module' => 'System',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        });

        return response()->json(['message' => 'Data operasional berhasil direset.']);
    }
}
