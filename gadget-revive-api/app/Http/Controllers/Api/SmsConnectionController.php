<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\SmsConnection;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Settings > SMS — connection build & test only. Which connection actually gets used for OTP,
 * order updates, or campaigns is configured separately on the dedicated SMS Center page
 * (SmsPurposeConfigController / SmsCampaignController), not here.
 */
class SmsConnectionController extends BaseController
{
    public function __construct(protected SmsService $sms) {}

    protected function rules(bool $partial = false): array
    {
        $req = $partial ? 'sometimes|required' : 'required';
        return [
            'name'          => "{$req}|string|max:255",
            'provider_name' => 'nullable|string|max:255',
            'api_url'       => "{$req}|string|max:2000",
            'balance_url'   => 'nullable|string|max:2000',
            'report_url'    => 'nullable|string|max:2000',
            'method'        => 'nullable|in:GET,POST',
            'api_key'       => 'nullable|string|max:255',
            'sender_id'     => 'nullable|string|max:100',
            'phone_format'  => 'nullable|in:as_is,bd_880',
            'is_active'     => 'nullable|boolean',
        ];
    }

    public function index(): JsonResponse
    {
        return $this->success(SmsConnection::orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $data['method'] = strtoupper($data['method'] ?? 'GET');
        $data['created_by'] = $request->user()->id;

        $connection = SmsConnection::create($data);

        AuditLog::log($request->user(), 'create_sms_connection', 'SmsConnection', $connection->id, null, $data, "SMS connection \"{$connection->name}\" created");

        return $this->created($connection);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $connection = SmsConnection::findOrFail($id);
        $data = $request->validate($this->rules(partial: true));
        if (isset($data['method'])) {
            $data['method'] = strtoupper($data['method']);
        }

        $old = $connection->only(array_keys($data));
        $connection->update($data);

        AuditLog::log($request->user(), 'update_sms_connection', 'SmsConnection', $connection->id, $old, $data, "SMS connection \"{$connection->name}\" updated");

        return $this->success($connection->fresh());
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $connection = SmsConnection::findOrFail($id);

        // Don't silently orphan a purpose that's actively relying on this connection — deleting it
        // out from under OTP/order sending would look like SMS just stopped working for no reason.
        $inUse = \App\Models\SiteSetting::whereIn('key', ['sms_otp_connection_id', 'sms_order_connection_id', 'sms_campaign_connection_id'])
            ->where('value', (string) $id)
            ->pluck('key')
            ->map(fn ($key) => str_replace(['sms_', '_connection_id'], ['', ''], $key))
            ->all();

        if (!empty($inUse)) {
            return $this->error('This connection is currently assigned to: ' . implode(', ', $inUse) . '. Reassign those on the SMS Center page first.', 422);
        }

        $name = $connection->name;
        $connection->delete();

        AuditLog::log($request->user(), 'delete_sms_connection', 'SmsConnection', $id, ['name' => $name], null, "SMS connection \"{$name}\" deleted");

        return $this->success(null, 'Connection deleted');
    }

    /**
     * POST /admin/sms/connections/test — tests either an already-saved connection (pass
     * connection_id) or a not-yet-saved draft (pass the connection fields directly), so "build and
     * test" can happen before ever clicking Save.
     */
    public function test(Request $request): JsonResponse
    {
        $data = $request->validate([
            'connection_id' => 'nullable|exists:sms_connections,id',
            'phone'         => 'required|string|max:20',
            'message'       => 'nullable|string|max:500',
            'name'          => 'required_without:connection_id|string|max:255',
            'api_url'       => 'required_without:connection_id|string|max:2000',
            'method'        => 'nullable|in:GET,POST',
            'api_key'       => 'nullable|string|max:255',
            'sender_id'     => 'nullable|string|max:100',
            'phone_format'  => 'nullable|in:as_is,bd_880',
        ]);

        $connection = $data['connection_id'] ?? null
            ? SmsConnection::findOrFail($data['connection_id'])
            : new SmsConnection([
                'name' => $data['name'] ?? 'Unsaved test connection',
                'api_url' => $data['api_url'] ?? '',
                'method' => strtoupper($data['method'] ?? 'GET'),
                'api_key' => $data['api_key'] ?? null,
                'sender_id' => $data['sender_id'] ?? null,
                'phone_format' => $data['phone_format'] ?? 'as_is',
            ]);

        $appName = \App\Models\SiteSetting::get('site_name', 'Gadget & Revive');
        $message = $data['message'] ?? "This is a test SMS from {$appName}'s admin panel. If you received this, this connection is configured correctly.";

        $ok = $this->sms->sendTest($connection, $data['phone'], $message, $request->user());

        return $ok
            ? $this->success(null, 'Test SMS sent — check the phone and the log below to confirm delivery.')
            : $this->error('Test SMS failed to send. Check the log below for the gateway\'s response.', 422);
    }

    /** GET /admin/sms/connections/{id}/balance — live, uncached balance/validity check. Always
     *  200s: `configured: false` means this connection has no balance_url set, `configured: true,
     *  ok: false` means the check ran but the provider rejected it — both are things the SMS
     *  Center's overview card needs to render, not error states to throw at the frontend. */
    public function balance(int $id): JsonResponse
    {
        $connection = SmsConnection::findOrFail($id);
        $result = $this->sms->checkBalance($connection);

        if ($result === null) {
            return $this->success([
                'configured' => false, 'ok' => false, 'balance' => null, 'validity' => null, 'raw' => null,
            ], 'No balance-check URL configured for this connection.');
        }

        return $this->success(array_merge(['configured' => true], $result));
    }

    /** GET /admin/sms/usage — volume + spend breakdown by purpose, for the SMS Center's account
     *  overview. "total_cost" is only ever as complete as each connection's report_url capture
     *  managed to fill in (see SmsService::captureCost) — sends through a connection with no
     *  report_url configured only ever contribute to the counts, not the cost total, so this is a
     *  lower bound on spend rather than an exact figure unless every connection in use has one. */
    public function usage(Request $request): JsonResponse
    {
        $query = \App\Models\SmsLog::query();
        if ($request->filled('connection_id')) {
            $query->where('sms_connection_id', $request->connection_id);
        }
        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->to);
        }

        $byPurpose = (clone $query)
            ->selectRaw("purpose, COUNT(*) as total, SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent, SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed, SUM(cost) as total_cost")
            ->groupBy('purpose')
            ->get();

        return $this->success([
            'by_purpose' => $byPurpose,
            'overall' => [
                'total'      => (clone $query)->count(),
                'sent'       => (clone $query)->where('status', 'sent')->count(),
                'failed'     => (clone $query)->where('status', 'failed')->count(),
                'total_cost' => (clone $query)->sum('cost'),
            ],
        ]);
    }

    /** GET /admin/sms/logs — recent send history across every connection/purpose, newest first. */
    public function logs(Request $request): JsonResponse
    {
        $query = \App\Models\SmsLog::with(['sender:id,name', 'connection:id,name'])->latest();

        if ($request->filled('purpose')) {
            // Comma-separated so a panel covering several related purposes (e.g. every
            // Order & Billing send type) can show them together in one log instead of each
            // needing its own separately-filtered table.
            $query->whereIn('purpose', explode(',', $request->purpose));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('connection_id')) {
            $query->where('sms_connection_id', $request->connection_id);
        }

        return $this->paginated($query->paginate($request->get('per_page', 25)));
    }
}
