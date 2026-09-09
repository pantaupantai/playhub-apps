<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('track_stock')->default(true)->after('stock');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->decimal('service_charge', 15, 2)->default(0)->after('tax');
            $table->string('void_reason')->nullable()->after('notes');
            $table->foreignId('voided_by')->nullable()->after('void_reason')->constrained('users')->nullOnDelete();
            $table->timestamp('voided_at')->nullable()->after('voided_by');
            $table->string('refund_reason')->nullable()->after('voided_at');
            $table->decimal('refund_amount', 15, 2)->default(0)->after('refund_reason');
            $table->foreignId('refunded_by')->nullable()->after('refund_amount')->constrained('users')->nullOnDelete();
            $table->timestamp('refunded_at')->nullable()->after('refunded_by');
        });

        Schema::table('transaction_details', function (Blueprint $table) {
            $table->decimal('discount', 15, 2)->default(0)->after('cost_price');
        });

        Schema::create('table_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('table_id')->constrained('tables')->cascadeOnDelete();
            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('cashier_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('duration_minutes')->default(0);
            $table->string('status')->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('cashier_shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cashier_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->decimal('opening_cash', 15, 2)->default(0);
            $table->decimal('closing_cash', 15, 2)->nullable();
            $table->decimal('expected_cash', 15, 2)->default(0);
            $table->decimal('cash_difference', 15, 2)->default(0);
            $table->string('status')->default('open');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('backup_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('filename');
            $table->string('path');
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('backup_logs');
        Schema::dropIfExists('cashier_shifts');
        Schema::dropIfExists('table_histories');

        Schema::table('transaction_details', function (Blueprint $table) {
            $table->dropColumn('discount');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('refunded_by');
            $table->dropConstrainedForeignId('voided_by');
            $table->dropColumn(['service_charge', 'void_reason', 'voided_at', 'refund_reason', 'refund_amount', 'refunded_at']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('track_stock');
        });
    }
};
