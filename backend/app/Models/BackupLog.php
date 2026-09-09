<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BackupLog extends Model
{
    protected $fillable = [
        'user_id',
        'filename',
        'path',
        'size_bytes',
    ];
}
