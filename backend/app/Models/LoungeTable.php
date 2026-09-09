<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoungeTable extends Model
{
    protected $table = 'tables';

    protected $fillable = [
        'name',
        'number',
        'position_x',
        'position_y',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [];
    }
}
