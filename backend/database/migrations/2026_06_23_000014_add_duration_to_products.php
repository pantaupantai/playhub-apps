<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Durasi (menit) untuk produk paket waktu, mis. "Sewa Mahjong 1 Jam" = 60.
            // Produk non-waktu (minuman/snack) dibiarkan null.
            $table->unsignedInteger('duration_minutes')->nullable()->after('track_stock');
        });

        // Backfill paket waktu yang sudah ter-seed (berdasarkan SKU).
        DB::table('products')->where('sku', 'MJ-1H')->update(['duration_minutes' => 60]);
        DB::table('products')->where('sku', 'QR-ROOM')->update(['duration_minutes' => 120]);
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('duration_minutes');
        });
    }
};
