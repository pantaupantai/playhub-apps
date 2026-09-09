<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends ResourceController
{
    protected string $model = Product::class;

    protected array $storeRules = [
        'category_id' => ['required', 'exists:categories,id'],
        'sku' => ['required', 'string', 'max:80', 'unique:products,sku'],
        'barcode' => ['nullable', 'string', 'max:120'],
        'name' => ['required', 'string', 'max:160'],
        'photo' => ['nullable', 'string'],
        'cost_price' => ['required', 'numeric', 'min:0'],
        'sell_price' => ['required', 'numeric', 'min:0'],
        'stock' => ['required', 'integer', 'min:0'],
        'track_stock' => ['boolean'],
        'is_active' => ['boolean'],
    ];

    public function store(Request $request)
    {
        $data = $this->normalizeProductData($request->validate($this->storeRules));
        $product = Product::create($data);

        return response()->json($product, 201);
    }

    public function update(Request $request, int $id)
    {
        $product = Product::findOrFail($id);
        $data = $request->validate([
            'category_id' => ['sometimes', 'exists:categories,id'],
            'sku' => ['sometimes', 'string', 'max:80', Rule::unique('products', 'sku')->ignore($product->id)],
            'barcode' => ['nullable', 'string', 'max:120'],
            'name' => ['sometimes', 'string', 'max:160'],
            'photo' => ['nullable', 'string'],
            'cost_price' => ['sometimes', 'numeric', 'min:0'],
            'sell_price' => ['sometimes', 'numeric', 'min:0'],
            'stock' => ['sometimes', 'integer', 'min:0'],
            'track_stock' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $data = $this->normalizeProductData($data);

        $product->update($data);

        return response()->json($product);
    }

    public function upload(Request $request, Product $product)
    {
        $request->validate(['photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048']]);
        $path = $request->file('photo')->store('products', 'public');
        $product->update(['photo' => $path]);

        return response()->json($product);
    }

    protected function searchable(): array
    {
        return ['name', 'sku', 'barcode'];
    }

    private function normalizeProductData(array $data): array
    {
        if (array_key_exists('sell_price', $data)) {
            $data['sell_price'] = round((float) $data['sell_price'], 2);
        }

        // Frontend lama dapat mengirim URL tampilan berulang seperti
        // /storage/https://domain/storage/products/foo.jpg. Simpan hanya path
        // relatif agar nilainya tidak terus memanjang setiap kali produk diedit.
        if (array_key_exists('photo', $data) && is_string($data['photo'])) {
            if (str_contains($data['photo'], 'placeholder-product.svg')) {
                $data['photo'] = null;
            } elseif (str_contains($data['photo'], 'products/')) {
                $data['photo'] = 'products/'.last(explode('products/', $data['photo']));
            } elseif (str_starts_with($data['photo'], '/storage/')) {
                $data['photo'] = substr($data['photo'], strlen('/storage/'));
            }
        }

        return $data;
    }
}
