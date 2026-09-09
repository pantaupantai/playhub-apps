<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cashier_shifts', function (Blueprint $table) {
            // Nomor shift harian (1 atau 2) — terdeteksi otomatis saat buka shift.
            $table->unsignedInteger('shift_number')->default(1)->after('cashier_id');
        });
    }

    public function down(): void
    {
        Schema::table('cashier_shifts', function (Blueprint $table) {
            $table->dropColumn('shift_number');
        });
    }
};
