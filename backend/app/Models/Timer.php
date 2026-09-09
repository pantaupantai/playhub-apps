<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Timer extends Model
{
    protected $fillable = [
        'table_id',
        'transaction_id',
        'duration_minutes',
        'started_at',
        'ends_at',
        'status',
        'acknowledged_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ends_at' => 'datetime',
            'acknowledged_at' => 'datetime',
        ];
    }

    public function reminder()
    {
        return $this->hasOne(Reminder::class);
    }
}
