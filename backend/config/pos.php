<?php

return [
    // Persentase pajak (PB1/PPN) default yang diterapkan saat checkout.
    // Set 0 untuk usaha non-PKP / tanpa pajak.
    'tax_percent' => (float) env('POS_TAX_PERCENT', 10),

    // Persentase service charge default (boleh dioverride per transaksi).
    'service_percent' => (float) env('POS_SERVICE_PERCENT', 0),

    // Ingatkan berapa menit sebelum waktu meja habis (mis. 10 menit).
    'reminder_before_minutes' => (int) env('POS_REMINDER_BEFORE_MINUTES', 10),
];
