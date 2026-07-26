<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gates a route on a Spatie permission — `permission:manage_users` passes only if the
 * authenticated user's assigned role(s) grant that permission. Stacks on top of `role:...`
 * (which only checks the coarse users.role column); this is the fine-grained layer.
 */
class PermissionMiddleware
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        foreach ($permissions as $permission) {
            if ($user->can($permission)) {
                return $next($request);
            }
        }

        return response()->json([
            'success' => false,
            'message' => 'Forbidden: you do not have the required permission for this action',
        ], 403);
    }
}
