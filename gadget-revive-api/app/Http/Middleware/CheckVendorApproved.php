<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckVendorApproved
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->isVendor()) {
            $vendorProfile = $user->vendorProfile;
            
            if (!$vendorProfile || $vendorProfile->status !== 'approved') {
                return response()->json([
                    'success' => false,
                    'message' => 'Your vendor account is not approved yet.',
                    'vendor_status' => $vendorProfile?->status ?? 'no_profile',
                ], 403);
            }
        }

        return $next($request);
    }
}
