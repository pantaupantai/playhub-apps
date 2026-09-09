<?php

namespace App\Http\Controllers\Api;

use App\Models\Reminder;
use App\Models\ActivityLog;
use App\Models\LoungeTable;
use App\Models\TableHistory;
use App\Models\Timer;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class TimerController extends ResourceController
{
    protected string $model = Timer::class;

    protected array $storeRules = [
        'table_id' => ['required', 'exists:tables,id'],
        'transaction_id' => ['nullable', 'exists:transactions,id'],
        'duration_minutes' => ['required', 'integer', 'min:1'],
        'started_at' => ['nullable', 'date'],
        'status' => ['nullable', 'in:running,expired,acknowledged,cancelled'],
    ];

    public function store(Request $request)
    {
        $rules = $this->storeRules;
        $rules['duration_minutes'] = ['required', 'integer', 'min:1', 'max:1440'];
        $data = $request->validate($rules + [
            'reminder_interval_minutes' => ['nullable', 'integer', 'min:1'],
        ]);

        $startedAt = isset($data['started_at']) ? Carbon::parse($data['started_at']) : now();
        $timer = Timer::create([
            ...$data,
            'started_at' => $startedAt,
            'ends_at' => $startedAt->copy()->addMinutes($data['duration_minutes']),
            'status' => 'running',
        ]);

        Reminder::create([
            'timer_id' => $timer->id,
            'remind_before_minutes' => config('pos.reminder_before_minutes'),
            'interval_minutes' => $data['reminder_interval_minutes'] ?? 5,
            'message' => 'Perhatian, waktu penggunaan {table} akan berakhir dalam {minutes} menit',
            'is_active' => true,
        ]);

        LoungeTable::whereKey($timer->table_id)->update(['status' => 'occupied']);
        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => "Set timer table {$timer->table_id}",
            'module' => 'Timer',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['timer_id' => $timer->id, 'duration_minutes' => $timer->duration_minutes],
        ]);

        return response()->json($timer->load('reminder'), 201);
    }

    public function acknowledge(Timer $timer)
    {
        $timer->update(['status' => 'acknowledged', 'acknowledged_at' => now()]);

        return response()->json($timer);
    }

    public function expire(Request $request, Timer $timer)
    {
        $timer->update(['status' => 'expired']);
        LoungeTable::whereKey($timer->table_id)->update(['status' => 'time_expired']);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => "Timer habis table {$timer->table_id}",
            'module' => 'Timer',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['timer_id' => $timer->id],
        ]);

        return response()->json($timer->load('reminder'));
    }

    public function finish(Request $request, Timer $timer)
    {
        $timer->update(['status' => 'acknowledged', 'acknowledged_at' => now()]);
        LoungeTable::whereKey($timer->table_id)->update(['status' => 'available']);
        TableHistory::where('table_id', $timer->table_id)
            ->where('status', 'active')
            ->latest()
            ->first()
            ?->update([
                'ended_at' => now(),
                'status' => 'finished',
            ]);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => "Selesaikan table {$timer->table_id}",
            'module' => 'Timer',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['timer_id' => $timer->id],
        ]);

        return response()->json($timer->load('reminder'));
    }

    public function extend(Request $request, Timer $timer)
    {
        $data = $request->validate([
            'minutes' => ['required', 'integer', 'min:1'],
        ]);

        $timer->update([
            'duration_minutes' => $timer->duration_minutes + $data['minutes'],
            'ends_at' => $timer->ends_at->copy()->addMinutes($data['minutes']),
            'status' => 'running',
            'acknowledged_at' => null,
        ]);

        TableHistory::where('table_id', $timer->table_id)
            ->where('status', 'active')
            ->latest()
            ->first()
            ?->increment('duration_minutes', $data['minutes']);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => "Extend timer table {$timer->table_id}",
            'module' => 'Timer',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['timer_id' => $timer->id, 'minutes' => $data['minutes']],
        ]);

        return response()->json($timer->fresh()->load('reminder'));
    }
}
