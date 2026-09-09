<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('table_histories', function (Blueprint $table) {
            $table->json('items')->nullable()->after('duration_minutes');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('duration_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedInteger('duration_minutes')->nullable()->after('track_stock');
        });

        Schema::table('table_histories', function (Blueprint $table) {
            $table->dropColumn('items');
        });

    }
};
