<?php

namespace App\Http\Controllers\Api;

use App\Models\Payment;
use App\Models\Product;
use App\Models\ActivityLog;
use App\Models\CashierShift;
use App\Models\LoungeTable;
use App\Models\TableHistory;
use App\Models\Timer;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class TransactionController extends ResourceController
{
    protected string $model = Transaction::class;

    public function openOrder(Request $request)
    {
        $data = $request->validate([
            'table_id' => ['required', 'exists:tables,id'],
            'cashier_id' => ['required', 'exists:users,id'],
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'in:open,hold'],
        ]);

        return DB::transaction(function () use ($data, $request) {
            $transaction = Transaction::where('table_id', $data['table_id'])
                ->whereIn('status', ['open', 'hold'])
                ->lockForUpdate()
                ->first();

            if (! $transaction) {
                $transaction = Transaction::create([
                    'invoice' => $this->nextInvoice(),
                    'table_id' => $data['table_id'],
                    'cashier_id' => $data['cashier_id'],
                    'subtotal' => 0,
                    'discount' => 0,
                    'tax' => 0,
                    'grand_total' => 0,
                    'status' => $data['status'] ?? 'open',
                ]);
            }

            $totals = $this->replaceDetails($transaction, $data['items'] ?? [], false);
            $transaction->update([
                'cashier_id' => $data['cashier_id'],
                'subtotal' => $totals['subtotal'],
                'discount' => 0,
                'tax' => 0,
                'grand_total' => $totals['subtotal'],
                'status' => $data['status'] ?? 'open',
            ]);

            ActivityLog::create([
                'user_id' => $data['cashier_id'],
                'action' => "Update order {$transaction->invoice}",
                'module' => 'POS',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'payload' => ['transaction_id' => $transaction->id],
            ]);

            return response()->json($transaction->load(['details.product', 'cashier', 'loungeTable']), 201);
        });
    }

    public function cancelOrder(Request $request)
    {
        $data = $request->validate([
            'table_id' => ['required', 'exists:tables,id'],
        ]);

        // Batalkan order yang belum dibayar (open/hold) untuk meja ini.
        // Detail ikut terhapus (cascade). Stok belum dipotong saat open order, jadi tidak perlu dikembalikan.
        Transaction::where('table_id', $data['table_id'])
            ->whereIn('status', ['open', 'hold'])
            ->get()
            ->each(function (Transaction $transaction) use ($request) {
                ActivityLog::create([
                    'user_id' => $request->user()?->id,
                    'action' => "Batal order {$transaction->invoice}",
                    'module' => 'POS',
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'payload' => ['transaction_id' => $transaction->id],
                ]);
                $transaction->delete();
            });

        return response()->json(['message' => 'Order dibatalkan.']);
    }

    public function checkout(Request $request)
    {
        $data = $request->validate([
            'table_id' => ['required', 'exists:tables,id'],
            'cashier_id' => ['required', 'exists:users,id'],
            'payment_method' => ['required', 'in:cash,qris,transfer,debit,kredit'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'service_charge' => ['nullable', 'numeric', 'min:0'],
            'service_charge_percent' => ['nullable', 'numeric', 'min:0'],
            'tax_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'duration_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'reminder_interval_minutes' => ['nullable', 'integer', 'min:1'],
        ]);

        // Hanya role Kasir yang wajib terikat shift terbuka (untuk rekonsiliasi kas).
        // Admin & Super Admin bisa checkout tanpa membuka shift kasir.
        if ($request->user()?->role?->name === 'Kasir') {
            abort_unless(
                CashierShift::where('cashier_id', $data['cashier_id'])->where('status', 'open')->exists(),
                422,
                'Kasir belum membuka shift. Buka shift dulu sebelum checkout.',
            );
        }

        return DB::transaction(function () use ($data, $request) {
            LoungeTable::lockForUpdate()->findOrFail($data['table_id']);
            $transaction = Transaction::where('table_id', $data['table_id'])
                ->whereIn('status', ['open', 'hold'])
                ->lockForUpdate()
                ->first();
            $totals = ['subtotal' => 0];

            if ($transaction) {
                $totals = $this->replaceDetails($transaction, $data['items'], true);
            } else {
                $transaction = Transaction::create([
                    'invoice' => $this->nextInvoice(),
                    'table_id' => $data['table_id'],
                    'cashier_id' => $data['cashier_id'],
                    'subtotal' => 0,
                    'discount' => 0,
                    'tax' => 0,
                    'grand_total' => 0,
                    'status' => 'open',
                ]);
                $totals = $this->replaceDetails($transaction, $data['items'], true);
            }

            $discount = $data['discount'] ?? 0;
            $taxable = max(0, $totals['subtotal'] - $discount);
            $taxPercent = $data['tax_percent'] ?? config('pos.tax_percent');
            $servicePercent = $data['service_charge_percent'] ?? config('pos.service_percent');
            $tax = round($taxable * ($taxPercent / 100), 0, PHP_ROUND_HALF_UP);

            // Service dihitung setelah pajak. Contoh: 43.290 x 110% x 105%
            // dibulatkan menjadi Rp50.000, dan rumus ini berlaku untuk seluruh item.
            $serviceBase = $taxable + $tax;
            $serviceCharge = $data['service_charge']
                ?? round($serviceBase * ($servicePercent / 100), 0, PHP_ROUND_HALF_UP);
            $grandTotal = round($taxable + $tax + $serviceCharge, 0, PHP_ROUND_HALF_UP);

            $transaction->update([
                'table_id' => $data['table_id'],
                'cashier_id' => $data['cashier_id'],
                'subtotal' => $totals['subtotal'],
                'discount' => $discount,
                'tax' => $tax,
                'service_charge' => $serviceCharge,
                'grand_total' => $grandTotal,
                'status' => 'paid',
            ]);

            Payment::create([
                'transaction_id' => $transaction->id,
                'method' => $data['payment_method'],
                'amount' => $grandTotal,
                'paid_at' => now(),
            ]);

            $existingTimer = Timer::where('table_id', $data['table_id'])
                ->whereIn('status', ['running', 'expired'])
                ->latest()
                ->first();

            if (! $existingTimer) {
                abort_unless(
                    isset($data['duration_minutes']),
                    422,
                    'Durasi penggunaan wajib ditentukan saat membuka meja.',
                );
                $sessionMinutes = (int) $data['duration_minutes'];
                $startedAt = Carbon::now();
                $timer = Timer::create([
                    'table_id' => $data['table_id'],
                    'transaction_id' => $transaction->id,
                    'duration_minutes' => $sessionMinutes,
                    'started_at' => $startedAt,
                    'ends_at' => $startedAt->copy()->addMinutes($sessionMinutes),
                    'status' => 'running',
                ]);

                $timer->reminder()->create([
                    'remind_before_minutes' => config('pos.reminder_before_minutes'),
                    'interval_minutes' => $data['reminder_interval_minutes'] ?? 5,
                    'message' => 'Perhatian, waktu penggunaan {table} akan berakhir dalam {minutes} menit',
                    'is_active' => true,
                ]);
            } else {
                // Checkout tambahan tidak mengubah durasi sesi yang sudah berjalan.
                $sessionMinutes = (int) $existingTimer->duration_minutes;
            }

            LoungeTable::whereKey($data['table_id'])->update(['status' => 'occupied']);

            // Satu sesi meja = satu baris history aktif; perpanjangan menambah durasinya.
            $activeHistory = TableHistory::where('table_id', $data['table_id'])
                ->where('status', 'active')
                ->latest()
                ->first();
            $historyItems = $this->mergeHistoryItems($activeHistory?->items ?? [], $totals['items']);
            if ($activeHistory) {
                $activeHistory->update(['items' => $historyItems]);
            } else {
                TableHistory::create([
                    'table_id' => $data['table_id'],
                    'transaction_id' => $transaction->id,
                    'cashier_id' => $data['cashier_id'],
                    'started_at' => now(),
                    'duration_minutes' => $sessionMinutes,
                    'items' => $historyItems,
                    'status' => 'active',
                    'notes' => "Checkout {$transaction->invoice}",
                ]);
            }
            ActivityLog::create([
                'user_id' => $data['cashier_id'],
                'action' => "Checkout {$transaction->invoice}",
                'module' => 'Transaksi',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'payload' => ['transaction_id' => $transaction->id, 'grand_total' => $grandTotal],
            ]);

            return response()->json($transaction->load(['details.product', 'payments', 'cashier', 'loungeTable']), 201);
        });
    }

    public function voidTransaction(Request $request, Transaction $transaction)
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);

        abort_if($transaction->status === 'cancelled', 422, 'Transaksi sudah dibatalkan.');

        DB::transaction(function () use ($transaction, $data, $request) {
            $transaction->load('details.product');

            foreach ($transaction->details as $detail) {
                if ($detail->product?->track_stock) {
                    $detail->product->increment('stock', $detail->qty);
                }
            }

            $transaction->update([
                'status' => 'cancelled',
                'void_reason' => $data['reason'],
                'voided_by' => $request->user()?->id,
                'voided_at' => now(),
            ]);

            // Bila transaksi ini yang membuka sesi meja (punya timer), bebaskan mejanya.
            $timer = Timer::where('transaction_id', $transaction->id)
                ->whereIn('status', ['running', 'expired', 'acknowledged'])
                ->first();
            if ($timer) {
                $timer->update(['status' => 'cancelled']);
                LoungeTable::whereKey($transaction->table_id)->update(['status' => 'available']);
                TableHistory::where('table_id', $transaction->table_id)
                    ->where('status', 'active')
                    ->latest()
                    ->first()
                    ?->update(['status' => 'cancelled', 'ended_at' => now()]);
            }

            ActivityLog::create([
                'user_id' => $request->user()?->id,
                'action' => "Void {$transaction->invoice}",
                'module' => 'Transaksi',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'payload' => ['transaction_id' => $transaction->id, 'reason' => $data['reason']],
            ]);
        });

        return response()->json($transaction->fresh()->load(['details.product', 'payments', 'cashier', 'loungeTable']));
    }

    public function refund(Request $request, Transaction $transaction)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        abort_if($transaction->status === 'cancelled', 422, 'Transaksi void tidak dapat direfund.');

        // Refund bersifat akumulatif: jumlahkan dengan refund sebelumnya, jangan menimpa.
        $totalRefund = (float) $transaction->refund_amount + (float) $data['amount'];
        abort_if($totalRefund > (float) $transaction->grand_total, 422, 'Total refund melebihi total transaksi.');

        $transaction->update([
            'refund_amount' => $totalRefund,
            'refund_reason' => $data['reason'],
            'refunded_by' => $request->user()?->id,
            'refunded_at' => now(),
        ]);

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => "Refund {$transaction->invoice}",
            'module' => 'Transaksi',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => ['transaction_id' => $transaction->id, 'amount' => $data['amount'], 'reason' => $data['reason']],
        ]);

        return response()->json($transaction->fresh()->load(['details.product', 'payments', 'cashier', 'loungeTable']));
    }

    private function nextInvoice(): string
    {
        $prefix = 'INV-'.now()->format('Ymd').'-';
        $last = Transaction::where('invoice', 'like', $prefix.'%')->lockForUpdate()->orderByDesc('invoice')->value('invoice');
        $sequence = $last ? ((int) substr($last, -4)) + 1 : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }

    private function replaceDetails(Transaction $transaction, array $rawItems, bool $decrementStock): array
    {
        $subtotal = 0;
        $historyItems = [];
        $items = collect($rawItems)->map(function ($item) use (&$subtotal, &$historyItems, $decrementStock) {
            $product = Product::lockForUpdate()->findOrFail($item['product_id']);
            if ($decrementStock && $product->track_stock) {
                abort_if($product->stock < $item['qty'], 422, "Stok {$product->name} tidak cukup.");
                $product->decrement('stock', $item['qty']);
            }
            $lineDiscount = min((float) ($item['discount'] ?? 0), $product->sell_price * $item['qty']);
            $lineSubtotal = ($product->sell_price * $item['qty']) - $lineDiscount;
            $subtotal += $lineSubtotal;
            $historyItems[] = [
                'product_id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'qty' => (int) $item['qty'],
            ];

            return [
                'product_id' => $product->id,
                'qty' => $item['qty'],
                'price' => $product->sell_price,
                'cost_price' => $product->cost_price,
                'discount' => $lineDiscount,
                'subtotal' => $lineSubtotal,
            ];
        });

        $transaction->details()->delete();
        $transaction->details()->createMany($items->all());

        return ['subtotal' => $subtotal, 'items' => $historyItems];
    }

    private function mergeHistoryItems(array $currentItems, array $newItems): array
    {
        return collect([...$currentItems, ...$newItems])
            ->groupBy(fn (array $item) => (string) ($item['product_id'] ?? $item['name'] ?? ''))
            ->map(function ($items): array {
                $first = $items->first();

                return [
                    'product_id' => isset($first['product_id']) ? (int) $first['product_id'] : null,
                    'sku' => (string) ($first['sku'] ?? ''),
                    'name' => (string) ($first['name'] ?? 'Produk'),
                    'qty' => (int) $items->sum(fn (array $item) => (int) ($item['qty'] ?? 0)),
                ];
            })
            ->values()
            ->all();
    }
}
