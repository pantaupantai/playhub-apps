<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('pos:ready', function () {
    $this->info('POS BILLING backend siap dijalankan di LAN.');
});
