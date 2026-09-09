<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends ResourceController
{
    protected string $model = User::class;

    protected array $storeRules = [
        'role_id' => ['required', 'exists:roles,id'],
        'name' => ['required', 'string', 'max:160'],
        'username' => ['required', 'string', 'max:80', 'unique:users,username'],
        'password' => ['required', 'string', 'min:8'],
        'status' => ['required', 'in:active,inactive'],
    ];

    protected array $updateRules = [
        'role_id' => ['sometimes', 'exists:roles,id'],
        'name' => ['sometimes', 'string', 'max:160'],
        'username' => ['sometimes', 'string', 'max:80'],
        'password' => ['sometimes', 'string', 'min:8'],
        'status' => ['sometimes', 'in:active,inactive'],
    ];

    public function update(Request $request, int $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'role_id' => ['sometimes', 'exists:roles,id'],
            'name' => ['sometimes', 'string', 'max:160'],
            'username' => ['sometimes', 'string', 'max:80', Rule::unique('users', 'username')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->update($data);

        return response()->json($user);
    }

    protected function searchable(): array
    {
        return ['name', 'username'];
    }
}
