<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'transactions_status_created_at_index');
        });

        Schema::table('timers', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'timers_status_created_at_index');
        });

        Schema::table('table_histories', function (Blueprint $table) {
            $table->index('created_at', 'table_histories_created_at_index');
        });

        Schema::table('cashier_shifts', function (Blueprint $table) {
            $table->index('created_at', 'cashier_shifts_created_at_index');
            $table->index(['cashier_id', 'status'], 'cashier_shifts_cashier_status_index');
        });

        Schema::table('backup_logs', function (Blueprint $table) {
            $table->index('created_at', 'backup_logs_created_at_index');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->index('created_at', 'activity_logs_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex('transactions_status_created_at_index');
        });

        Schema::table('timers', function (Blueprint $table) {
            $table->dropIndex('timers_status_created_at_index');
        });

        Schema::table('table_histories', function (Blueprint $table) {
            $table->dropIndex('table_histories_created_at_index');
        });

        Schema::table('cashier_shifts', function (Blueprint $table) {
            $table->dropIndex('cashier_shifts_created_at_index');
            $table->dropIndex('cashier_shifts_cashier_status_index');
        });

        Schema::table('backup_logs', function (Blueprint $table) {
            $table->dropIndex('backup_logs_created_at_index');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex('activity_logs_created_at_index');
        });
    }
};
