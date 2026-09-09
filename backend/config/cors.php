<?php

return [
    'paths' => ['api/*', 'broadcasting/auth'],
    'allowed_methods' => ['*'],
    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:5173'),
        'http://localhost',
        'http://localhost:4173',
        'http://localhost:5173',
        'http://127.0.0.1:4173',
        'http://127.0.0.1:5173',
    ],
    'allowed_origins_patterns' => [
        '/^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/',
        '/^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/',
        '/^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/',
        // Range Tailscale (100.64.0.0/10) — akses kasir lewat IP Tailscale office.
        '/^http:\/\/100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d+\.\d+(:\d+)?$/',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
