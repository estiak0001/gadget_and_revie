<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use App\Models\SmsCampaign;
use App\Models\SmsConnection;
use App\Models\User;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmsCampaignController extends BaseController
{
    // Sent synchronously within the request — there is no queue worker running in this
    // deployment (see deployment.md), so anything beyond a modest batch would just time the
    // request out instead of actually queuing. Larger audiences need splitting into multiple
    // sends until a real background worker exists.
    private const MAX_RECIPIENTS = 500;

    public function __construct(protected SmsService $sms) {}

    public function index(Request $request): JsonResponse
    {
        $query = SmsCampaign::with(['connection:id,name', 'creator:id,name'])->latest();

        return $this->paginated($query->paginate($request->get('per_page', 20)));
    }

    /** GET /admin/sms/campaigns/recipients-count?source=all_customers — quick "who would this
     *  reach" count for the composer, before committing to an actual send. */
    public function recipientsCount(Request $request): JsonResponse
    {
        $request->validate(['source' => 'required|in:all_customers']);

        $count = User::where('role', 'customer')->whereNotNull('phone')->where('phone', '!=', '')->count();

        return $this->success(['count' => $count]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'              => 'required|string|max:255',
            'message'           => 'required|string|max:500',
            'connection_id'     => 'required|exists:sms_connections,id',
            'recipient_source'  => 'required|in:all_customers,manual',
            'phones'            => 'required_if:recipient_source,manual|array',
            'phones.*'          => 'string|max:20',
        ]);

        $connection = SmsConnection::findOrFail($data['connection_id']);
        if (!$connection->is_active) {
            return $this->error('This connection is disabled — enable it on Settings > SMS first.', 422);
        }

        if ($data['recipient_source'] === 'all_customers') {
            $phones = User::where('role', 'customer')->whereNotNull('phone')->where('phone', '!=', '')->pluck('phone')->all();
        } else {
            $phones = collect($data['phones'])->map(fn ($p) => trim($p))->filter()->unique()->values()->all();
        }

        if (empty($phones)) {
            return $this->error('No recipients to send to.', 422);
        }
        if (count($phones) > self::MAX_RECIPIENTS) {
            return $this->error('This would send to ' . count($phones) . ' numbers — campaigns are capped at ' . self::MAX_RECIPIENTS . ' per send (sent synchronously, no background queue is running). Split this into smaller batches.', 422);
        }

        $campaign = SmsCampaign::create([
            'name' => $data['name'],
            'message' => $data['message'],
            'sms_connection_id' => $connection->id,
            'recipient_source' => $data['recipient_source'],
            'recipient_count' => count($phones),
            'created_by' => $request->user()->id,
        ]);

        $result = $this->sms->sendCampaign($connection, $data['message'], $phones, $campaign->id, $request->user());

        $campaign->update([
            'sent_count' => $result['sent'],
            'failed_count' => $result['failed'],
            'status' => $result['sent'] > 0 ? 'completed' : 'failed',
        ]);

        AuditLog::log(
            $request->user(),
            'send_sms_campaign',
            'SmsCampaign',
            $campaign->id,
            null,
            ['recipients' => count($phones), 'sent' => $result['sent'], 'failed' => $result['failed']],
            "SMS campaign \"{$campaign->name}\" sent to " . count($phones) . " recipient(s): {$result['sent']} sent, {$result['failed']} failed"
        );

        return $this->created($campaign->fresh(['connection:id,name']), "Campaign sent: {$result['sent']} delivered, {$result['failed']} failed.");
    }
}
