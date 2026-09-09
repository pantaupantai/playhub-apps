<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TableHistory extends Model
{
    protected $fillable = [
        'table_id',
        'transaction_id',
        'cashier_id',
        'started_at',
        'ended_at',
        'duration_minutes',
        'items',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'duration_minutes' => 'integer',
            'items' => 'array',
        ];
    }

    public function transaction()
    {
        return $this->belongsTo(Transaction::class);
    }
}
