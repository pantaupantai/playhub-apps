<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $user = User::with('role')->where('username', $credentials['username'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password) || $user->status !== 'active') {
            throw ValidationException::withMessages(['username' => 'Username atau password tidak valid.']);
        }

        $token = auth('api')->login($user);

        ActivityLog::create([
            'user_id' => $user->id,
            'action' => 'Login',
            'module' => 'Auth',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return $this->respondWithToken($token, $user);
    }

    public function me()
    {
        return response()->json(auth('api')->user()->load('role'));
    }

    public function logout(Request $request)
    {
        ActivityLog::create([
            'user_id' => $request->user()->id,
            'action' => 'Logout',
            'module' => 'Auth',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        auth('api')->logout();

        return response()->json(['message' => 'Logout berhasil.']);
    }

    public function refresh()
    {
        return $this->respondWithToken(auth('api')->refresh(), auth('api')->user());
    }

    public function resetPassword(Request $request, User $user)
    {
        $request->validate(['password' => ['required', 'min:8']]);
        $user->update(['password' => $request->password]);

        return response()->json(['message' => 'Password berhasil direset.']);
    }

    private function respondWithToken(string $token, User $user)
    {
        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => $user->load('role'),
        ]);
    }
}
