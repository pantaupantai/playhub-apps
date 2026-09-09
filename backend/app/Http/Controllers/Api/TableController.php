<?php

namespace App\Http\Controllers\Api;

use App\Models\LoungeTable;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TableController extends ResourceController
{
    protected string $model = LoungeTable::class;

    protected array $storeRules = [
        'name' => ['required', 'string', 'max:80'],
        'number' => ['required', 'string', 'max:20', 'unique:tables,number'],
        'position_x' => ['required', 'integer', 'min:0'],
        'position_y' => ['required', 'integer', 'min:0'],
        'status' => ['required', 'in:available,occupied,reserved,maintenance,time_expired'],
        'notes' => ['nullable', 'string'],
    ];

    public function update(Request $request, int $id)
    {
        $table = LoungeTable::findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'number' => ['sometimes', 'string', 'max:20', Rule::unique('tables', 'number')->ignore($table->id)],
            'position_x' => ['sometimes', 'integer', 'min:0'],
            'position_y' => ['sometimes', 'integer', 'min:0'],
            'status' => ['sometimes', 'in:available,occupied,reserved,maintenance,time_expired'],
            'notes' => ['nullable', 'string'],
        ]);

        $table->update($data);

        return response()->json($table);
    }

    public function destroy(int $id)
    {
        $table = LoungeTable::findOrFail($id);
        abort_if(
            Transaction::where('table_id', $id)->exists(),
            422,
            'Meja tidak bisa dihapus karena sudah memiliki transaksi. Ubah status ke Maintenance bila tidak dipakai.',
        );
        $table->delete();

        return response()->json(['message' => 'Meja dihapus.']);
    }

    public function updatePosition(Request $request, LoungeTable $table)
    {
        $data = $request->validate([
            'position_x' => ['required', 'integer', 'min:0'],
            'position_y' => ['required', 'integer', 'min:0'],
        ]);

        $table->update($data);

        return response()->json($table);
    }
}
