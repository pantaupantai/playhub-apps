<?php

namespace App\Http\Controllers\Api;

use App\Models\Category;

class CategoryController extends ResourceController
{
    protected string $model = Category::class;

    protected array $storeRules = [
        'name' => ['required', 'string', 'max:100'],
        'description' => ['nullable', 'string'],
        'is_active' => ['boolean'],
    ];
}
