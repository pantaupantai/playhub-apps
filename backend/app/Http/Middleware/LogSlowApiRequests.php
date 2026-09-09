<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class LogSlowApiRequests
{
    private const SLOW_REQUEST_THRESHOLD_MS = 2000;

    public function handle(Request $request, Closure $next): Response
    {
        $startedAt = hrtime(true);
        $response = null;

        try {
            $response = $next($request);

            return $response;
        } finally {
            $durationMs = round((hrtime(true) - $startedAt) / 1_000_000, 1);

            if ($response instanceof Response) {
                $response->headers->set('Server-Timing', "app;dur={$durationMs}");
            }

            if ($durationMs >= self::SLOW_REQUEST_THRESHOLD_MS) {
                Log::warning('Slow API request', [
                    'method' => $request->method(),
                    'path' => $request->path(),
                    'status' => $response?->getStatusCode(),
                    'duration_ms' => $durationMs,
                    'user_id' => $request->user()?->id,
                ]);
            }
        }
    }
}
