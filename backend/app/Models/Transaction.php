<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    protected $fillable = [
        'invoice',
        'table_id',
        'cashier_id',
        'subtotal',
        'discount',
        'tax',
        'service_charge',
        'grand_total',
        'status',
        'notes',
        'void_reason',
        'voided_by',
        'voided_at',
        'refund_reason',
        'refund_amount',
        'refunded_by',
        'refunded_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'tax' => 'decimal:2',
            'service_charge' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'refund_amount' => 'decimal:2',
            'voided_at' => 'datetime',
            'refunded_at' => 'datetime',
        ];
    }

    public function details()
    {
        return $this->hasMany(TransactionDetail::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function cashier()
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    public function loungeTable()
    {
        return $this->belongsTo(LoungeTable::class, 'table_id');
    }
}
