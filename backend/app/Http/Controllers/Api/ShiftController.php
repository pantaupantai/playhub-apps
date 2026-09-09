<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\CashierShift;
use App\Models\Transaction;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    public function index()
    {
        return response()->json(CashierShift::with('cashier')->latest()->limit(100)->get());
    }

    public function open(Request $request)
    {
        $data = $request->validate([
            'opening_cash' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $cashierId = $request->user()->id;
        abort_if(CashierShift::where('cashier_id', $cashierId)->where('status', 'open')->exists(), 422, 'Shift kasir masih terbuka.');

        // Nomor shift terdeteksi otomatis dari jumlah shift yang sudah dibuka hari ini.
        // Outlet hanya punya 2 shift per hari, jadi shift ke-3 ditolak.
        $shiftsToday = CashierShift::whereDate('opened_at', now()->toDateString())->count();
        abort_if($shiftsToday >= 2, 422, 'Shift hari ini sudah penuh (maksimal 2 shift per hari).');

        $shift = CashierShift::create([
            'cashier_id' => $cashierId,
            'shift_number' => $shiftsToday + 1,
            'opened_at' => now(),
            'opening_cash' => $data['opening_cash'] ?? 0,
            'status' => 'open',
            'notes' => $data['notes'] ?? null,
        ]);

        ActivityLog::create([
            'user_id' => $cashierId,
            'action' => 'Buka shift kasir',
            'module' => 'Shift',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json($shift->load('cashier'), 201);
    }

    public function close(Request $request, CashierShift $shift)
    {
        $data = $request->validate([
            'closing_cash' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        abort_if($shift->status !== 'open', 422, 'Shift sudah ditutup.');

        $cashSales = Transaction::where('cashier_id', $shift->cashier_id)
            ->where('status', 'paid')
            ->whereBetween('created_at', [$shift->opened_at, now()])
            ->whereHas('payments', fn ($query) => $query->where('method', 'cash'))
            ->sum('grand_total');
        // Refund tunai mengurangi isi laci kas yang diharapkan.
        $cashRefunds = Transaction::where('cashier_id', $shift->cashier_id)
            ->whereBetween('refunded_at', [$shift->opened_at, now()])
            ->whereHas('payments', fn ($query) => $query->where('method', 'cash'))
            ->sum('refund_amount');
        $expectedCash = $shift->opening_cash + $cashSales - $cashRefunds;
        $cashDifference = $data['closing_cash'] - $expectedCash;

        $shift->update([
            'closed_at' => now(),
            'closing_cash' => $data['closing_cash'],
            'expected_cash' => $expectedCash,
            'cash_difference' => $cashDifference,
            'status' => 'closed',
            'notes' => $data['notes'] ?? $shift->notes,
        ]);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'Tutup shift kasir',
            'module' => 'Shift',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['shift_id' => $shift->id, 'cash_difference' => $cashDifference],
        ]);

        return response()->json($shift->fresh()->load('cashier'));
    }
}
