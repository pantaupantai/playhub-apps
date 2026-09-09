<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

abstract class ResourceController extends Controller
{
    protected string $model;

    protected array $storeRules = [];

    protected array $updateRules = [];

    public function index(Request $request)
    {
        $model = $this->model;
        $query = $model::query();

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($builder) use ($search) {
                foreach ($this->searchable() as $column) {
                    $builder->orWhere($column, 'like', "%{$search}%");
                }
            });
        }

        return response()->json($query->latest()->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->storeRules);
        /** @var Model $record */
        $model = $this->model;
        $record = $model::create($data);

        return response()->json($record, 201);
    }

    public function show(int $id)
    {
        $model = $this->model;

        return response()->json($model::findOrFail($id));
    }

    public function update(Request $request, int $id)
    {
        $model = $this->model;
        $record = $model::findOrFail($id);
        $record->update($request->validate($this->updateRules ?: $this->storeRules));

        return response()->json($record);
    }

    public function destroy(int $id)
    {
        $model = $this->model;
        $model::findOrFail($id)->delete();

        return response()->json(['message' => 'Data berhasil dihapus.']);
    }

    protected function searchable(): array
    {
        return ['name'];
    }
}
