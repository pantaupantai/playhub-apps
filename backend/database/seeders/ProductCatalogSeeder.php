<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProductCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = [
            ['category' => 'Mahjong', 'sku' => 'PLAYHUB-01-WEEKEND', 'name' => 'PlayHub 1 Weekend', 'price' => 30000],

            ['category' => 'Board Game', 'sku' => 'PLAYHUB-02-WEEKDAY', 'name' => 'PlayHub 2', 'price' => 25000],
            ['category' => 'Board Game', 'sku' => 'PLAYHUB-02-WEEKEND', 'name' => 'PlayHub 2 Weekend', 'price' => 30000],

            ['category' => 'Board Game Premium', 'sku' => 'PLAYHUB-03-WEEKDAY', 'name' => 'PlayHub 3', 'price' => 40000],
            ['category' => 'Board Game Premium', 'sku' => 'PLAYHUB-03-WEEKEND', 'name' => 'PlayHub 3 Weekend', 'price' => 50000],

            ['category' => 'Billiard', 'sku' => 'PLAYHUB-04-WEEKDAY', 'name' => 'PlayHub 4', 'price' => 50000],
            ['category' => 'Billiard', 'sku' => 'PLAYHUB-04-WEEKEND', 'name' => 'PlayHub 4 Weekend', 'price' => 60000],

            ['category' => 'Domino', 'sku' => 'PLAYHUB-05-WEEKDAY', 'name' => 'PlayHub 5', 'price' => 20000],
            ['category' => 'Domino', 'sku' => 'PLAYHUB-05-WEEKEND', 'name' => 'PlayHub 5 Weekend', 'price' => 20000],

            ['category' => 'Bridge', 'sku' => 'PLAYHUB-06-WEEKDAY', 'name' => 'PlayHub 6', 'price' => 40000],
            ['category' => 'Bridge', 'sku' => 'PLAYHUB-06-WEEKEND', 'name' => 'PlayHub 6 Weekend', 'price' => 40000],

            ['category' => 'VIP Room', 'sku' => 'PLAYHUB-07-WEEKDAY', 'name' => 'PlayHub 7', 'price' => 200000],
            ['category' => 'VIP Room', 'sku' => 'PLAYHUB-07-WEEKEND', 'name' => 'PlayHub 7 Weekend', 'price' => 250000],

            ['category' => 'Mahjong Package 3 Jam', 'sku' => 'PACKAGE-PLAYHUB-01-WEEKEND', 'name' => 'Paket PlayHub 1 Weekend', 'price' => 70000],

            ['category' => 'Billiard Package 2 Jam', 'sku' => 'PACKAGE-PLAYHUB-02-WEEKDAY', 'name' => 'Paket PlayHub 2', 'price' => 90000],
            ['category' => 'Billiard Package 2 Jam', 'sku' => 'PACKAGE-PLAYHUB-02-WEEKEND', 'name' => 'Paket PlayHub 2 Weekend', 'price' => 110000],
        ];

        DB::transaction(function () use ($catalog): void {
            $categories = collect($catalog)
                ->pluck('category')
                ->unique()
                ->mapWithKeys(function (string $name): array {
                    $category = Category::updateOrCreate(
                        ['name' => $name],
                        ['description' => null, 'is_active' => true],
                    );

                    return [$name => $category];
                });

            foreach ($catalog as $item) {
                Product::updateOrCreate(
                    ['sku' => $item['sku']],
                    [
                        'category_id' => $categories[$item['category']]->id,
                        'barcode' => null,
                        'name' => $item['name'],
                        'photo' => null,
                        'cost_price' => 0,
                        'sell_price' => $item['price'],
                        'stock' => 0,
                        'track_stock' => false,
                        'is_active' => true,
                    ],
                );
            }
        });
    }
}
