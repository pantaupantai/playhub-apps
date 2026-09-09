<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Timer;
use App\Models\Transaction;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function summary(Request $request)
    {
        $transactions = Transaction::query()
            ->when($request->filled('cashier_id'), fn ($query) => $query->where('cashier_id', $request->cashier_id))
            ->when($request->filled('table_id'), fn ($query) => $query->where('table_id', $request->table_id))
            ->when($request->filled('from'), fn ($query) => $query->whereDate('created_at', '>=', $request->from))
            ->when($request->filled('to'), fn ($query) => $query->whereDate('created_at', '<=', $request->to))
            ->where('status', 'paid');

        // Omzet bersih = total dibayar dikurangi refund (transaksi void sudah dikecualikan).
        $gross = (clone $transactions)->sum('grand_total');
        $refunds = (clone $transactions)->sum('refund_amount');

        return response()->json([
            'total_transactions' => (clone $transactions)->count(),
            'total_revenue' => $gross - $refunds,
            'total_refund' => $refunds,
            'active_timers' => Timer::where('status', 'running')->count(),
            'active_products' => Product::where('is_active', true)->count(),
        ]);
    }

    public function export(Request $request, string $type)
    {
        abort_unless(in_array($type, ['excel', 'pdf', 'csv'], true), 404);

        $transactions = $this->filteredTransactions($request)->get();
        $filename = 'laporan-pos-billing-'.now()->format('Ymd-His');

        if ($type === 'csv') {
            return new StreamedResponse(function () use ($transactions) {
                $handle = fopen('php://output', 'w');
                fputcsv($handle, ['Invoice', 'Tanggal', 'Kasir', 'Meja', 'Metode', 'Subtotal', 'Diskon', 'Pajak', 'Service', 'Refund', 'Total', 'Status']);
                foreach ($transactions as $transaction) {
                    fputcsv($handle, $this->exportRow($transaction));
                }
                fclose($handle);
            }, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => "attachment; filename=\"{$filename}.csv\"",
            ]);
        }

        $html = $this->reportHtml($transactions);

        if ($type === 'excel') {
            return response($html, 200, [
                'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
                'Content-Disposition' => "attachment; filename=\"{$filename}.xls\"",
            ]);
        }

        return Pdf::loadHTML($html)->setPaper('a4', 'landscape')->download("{$filename}.pdf");
    }

    private function filteredTransactions(Request $request)
    {
        [$from, $to] = $this->dateRange($request);

        return Transaction::query()
            ->with(['cashier', 'loungeTable', 'payments'])
            ->whereBetween('created_at', [$from, $to])
            ->where('status', 'paid')
            ->when($request->filled('cashier_id') && $request->cashier_id !== 'all', fn ($query) => $query->where('cashier_id', $request->cashier_id))
            ->when($request->filled('table_id'), fn ($query) => $query->where('table_id', $request->table_id))
            ->latest();
    }

    private function dateRange(Request $request): array
    {
        $period = $request->string('period', 'day')->toString();
        $today = now();

        return match ($period) {
            'week' => [$today->copy()->startOfWeek(), $today->copy()->endOfWeek()],
            'month' => [$today->copy()->startOfMonth(), $today->copy()->endOfMonth()],
            'year' => [$today->copy()->startOfYear(), $today->copy()->endOfYear()],
            'range' => [
                Carbon::parse($request->input('from', $today->toDateString()))->startOfDay(),
                Carbon::parse($request->input('to', $today->toDateString()))->endOfDay(),
            ],
            default => [$today->copy()->startOfDay(), $today->copy()->endOfDay()],
        };
    }

    private function exportRow(Transaction $transaction): array
    {
        return [
            $transaction->invoice,
            $transaction->created_at->format('d/m/Y H:i'),
            $transaction->cashier?->name ?? '-',
            $transaction->loungeTable?->name ?? '-',
            $transaction->payments->first()?->method ?? '-',
            $transaction->subtotal,
            $transaction->discount,
            $transaction->tax,
            $transaction->service_charge,
            $transaction->refund_amount,
            $transaction->grand_total,
            $transaction->status,
        ];
    }

    private function reportHtml($transactions): string
    {
        $rows = $transactions->map(function (Transaction $transaction) {
            $row = $this->exportRow($transaction);

            return '<tr><td>'.implode('</td><td>', array_map('e', $row)).'</td></tr>';
        })->implode('');

        return <<<HTML
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #94a3b8; padding: 6px; text-align: left; }
                th { background: #0f172a; color: #ffffff; }
            </style>
        </head>
        <body>
            <h2>Laporan POS BILLING</h2>
            <table>
                <thead>
                    <tr>
                        <th>Invoice</th><th>Tanggal</th><th>Kasir</th><th>Meja</th><th>Metode</th>
                        <th>Subtotal</th><th>Diskon</th><th>Pajak</th><th>Service</th><th>Refund</th><th>Total</th><th>Status</th>
                    </tr>
                </thead>
                <tbody>{$rows}</tbody>
            </table>
        </body>
        </html>
        HTML;
    }
}
