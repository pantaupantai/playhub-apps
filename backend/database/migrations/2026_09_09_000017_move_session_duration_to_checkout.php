<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('tables', 'duration_minutes')) {
            Schema::table('tables', function (Blueprint $table) {
                $table->dropColumn('duration_minutes');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('tables', 'duration_minutes')) {
            Schema::table('tables', function (Blueprint $table) {
                $table->unsignedInteger('duration_minutes')->default(60)->after('status');
            });
        }
    }
};
