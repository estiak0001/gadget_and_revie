<?php

namespace App\Services;

use App\Models\SiteSetting;
use App\Models\SmsConnection;
use App\Models\SmsLog;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Generic, provider-agnostic SMS gateway, fanned out across multiple named SmsConnection rows
 * (e.g. two different providers, or a cheap one for campaigns vs a reliable one for OTP) rather
 * than a single global config. Each "purpose" (otp / order / campaign) independently picks which
 * connection it uses via the sms_{purpose}_connection_id + sms_{purpose}_enabled SiteSetting
 * pair — see resolveConnection()/isPurposeEnabled(). The actual request-building (URL template
 * substitution, GET/POST, provider JSON success detection) lives in sendVia() and is identical
 * regardless of which purpose or connection is calling it.
 */
class SmsService
{
    /** Which connection (if any) is currently assigned to a purpose ('otp' | 'order' | 'campaign'). */
    public function resolveConnection(string $purpose): ?SmsConnection
    {
        $id = SiteSetting::get("sms_{$purpose}_connection_id");
        if (!$id) {
            return null;
        }

        return SmsConnection::where('id', $id)->where('is_active', true)->first();
    }

    /** OTP/order sends are only automatic while both the purpose's own toggle is on AND it has an
     *  active connection assigned — campaigns have no such toggle since they're always a manual,
     *  one-off action rather than something that fires automatically off another event. */
    public function isPurposeEnabled(string $purpose): bool
    {
        return (bool) SiteSetting::get("sms_{$purpose}_enabled", false) && $this->resolveConnection($purpose) !== null;
    }

    // Back-compat aliases — AuthService/OrderController/GuestController/AdminController already
    // call these exact names from the single-connection version of this class.
    public function shouldSendOtp(): bool
    {
        return $this->isPurposeEnabled('otp');
    }

    public function shouldSendOrderUpdates(): bool
    {
        return $this->isPurposeEnabled('order');
    }

    /**
     * Live balance/validity check against the connection's balance_url — not every provider has
     * one, so this returns null (distinct from a failed check) when balance_url isn't configured,
     * letting the caller show "not supported for this connection" instead of a false error.
     *
     * @return array{ok: bool, balance: ?string, validity: ?string, raw: string}|null
     */
    public function checkBalance(SmsConnection $connection): ?array
    {
        $template = trim((string) $connection->balance_url);
        if ($template === '') {
            return null;
        }

        $params = [
            'api_key'   => (string) $connection->api_key,
            'sender_id' => (string) $connection->sender_id,
        ];
        $url = strtr($template, array_combine(
            array_map(fn ($k) => '{' . $k . '}', array_keys($params)),
            array_map('rawurlencode', array_values($params))
        ));

        try {
            $response = Http::timeout(15)->get($url);
            $decoded = json_decode($response->body(), true);

            return [
                'ok'       => $response->successful() && $this->bodyIndicatesSuccess($response->body()),
                'balance'  => $this->extractField($decoded, ['data.balance', 'balance']),
                'validity' => $this->extractField($decoded, ['data.validity', 'validity', 'data.expiry', 'expiry']),
                'raw'      => substr($response->body(), 0, 500),
            ];
        } catch (\Throwable $e) {
            return ['ok' => false, 'balance' => null, 'validity' => null, 'raw' => $e->getMessage()];
        }
    }

    /**
     * $templateKey/$defaultTemplate let callers other than plain signup-verification (currently:
     * password reset) use their own wording under the same OTP connection/enabled toggle, rather
     * than every kind of OTP sharing one generic "verification code" message regardless of what
     * it's actually for. Both are controllable from the SMS Center's OTP tab.
     */
    public function sendOtp(
        string $phone,
        string $otp,
        string $templateKey = 'sms_otp_template',
        string $defaultTemplate = 'Your {app} verification code is {otp}. It will expire shortly.'
    ): bool {
        $conn = $this->resolveConnection('otp');
        if (!$conn) {
            return false;
        }

        $appName = SiteSetting::get('site_name', 'Gadget & Revive');
        $template = SiteSetting::get($templateKey, $defaultTemplate);
        $message = strtr($template, ['{app}' => $appName, '{otp}' => $otp]);

        return $this->sendVia($conn, $phone, $message, 'otp');
    }

    public function sendOrderPlaced(string $phone, string $orderNumber, ?int $orderId = null): bool
    {
        $conn = $this->resolveConnection('order');
        if (!$conn) {
            return false;
        }

        $template = SiteSetting::get('sms_order_placed_template', "Thank you! Your order #{order} has been placed successfully. We'll notify you as it progresses.");
        $message = strtr($template, ['{order}' => $orderNumber]);

        return $this->sendVia($conn, $phone, $message, 'order_placed', $orderId);
    }

    public function sendOrderStatusChanged(string $phone, string $orderNumber, string $status, ?int $orderId = null): bool
    {
        $conn = $this->resolveConnection('order');
        if (!$conn) {
            return false;
        }

        return $this->sendVia($conn, $phone, $this->buildOrderStatusMessage($orderNumber, $status), 'order_status', $orderId);
    }

    /** Extracted so the admin's SMS confirmation modal can preview the exact text that would be
     *  sent (via a lightweight preview endpoint) without actually sending anything — same
     *  template resolution either way, so the preview can never drift from the real send. */
    public function buildOrderStatusMessage(string $orderNumber, string $status): string
    {
        $label = ucwords(str_replace('_', ' ', $status));
        $template = SiteSetting::get('sms_order_status_template', 'Update: your order #{order} is now {status}.');

        return strtr($template, ['{order}' => $orderNumber, '{status}' => $label]);
    }

    /** Deliberately manual, not automatic — there's no 'delivered' order_status in this system
     *  (delivery is a real-world event only the admin actually knows happened), so this is only
     *  ever called from an admin clicking a "Send Delivery SMS" button on the order. */
    public function sendOrderDelivered(string $phone, string $orderNumber, ?int $orderId = null): bool
    {
        $conn = $this->resolveConnection('order');
        if (!$conn) {
            return false;
        }

        return $this->sendVia($conn, $phone, $this->buildOrderDeliveredMessage($orderNumber), 'order_delivered', $orderId);
    }

    public function buildOrderDeliveredMessage(string $orderNumber): string
    {
        $template = SiteSetting::get('sms_order_delivered_template', 'Your order #{order} has been delivered. Thank you for shopping with {app}!');
        $appName = SiteSetting::get('site_name', 'Gadget & Revive');

        return strtr($template, ['{order}' => $orderNumber, '{app}' => $appName]);
    }

    /** Also manual — sent from a button next to a specific issued custom invoice, not fired
     *  automatically when the invoice is created (the admin decides whether/when the customer
     *  should be notified, same reasoning as sendOrderDelivered()). */
    public function sendCustomInvoiceSms(string $phone, string $invoiceNumber, string $total, ?int $relatedId = null): bool
    {
        $conn = $this->resolveConnection('order');
        if (!$conn) {
            return false;
        }

        return $this->sendVia($conn, $phone, $this->buildCustomInvoiceMessage($invoiceNumber, $total), 'custom_invoice', $relatedId);
    }

    public function buildCustomInvoiceMessage(string $invoiceNumber, string $total): string
    {
        $appName = SiteSetting::get('site_name', 'Gadget & Revive');
        $template = SiteSetting::get('sms_custom_invoice_template', 'Your {app} invoice {invoice} — Total: {total}. Thank you!');

        return strtr($template, ['{app}' => $appName, '{invoice}' => $invoiceNumber, '{total}' => $total]);
    }

    /** Also manual — a "Send Due SMS" button on the order, for reminding a customer of an
     *  outstanding balance. Never fired automatically off a payment or status change. */
    public function sendPaymentDueReminder(string $phone, string $orderNumber, string $amountDue, ?int $orderId = null): bool
    {
        $conn = $this->resolveConnection('order');
        if (!$conn) {
            return false;
        }

        return $this->sendVia($conn, $phone, $this->buildPaymentDueMessage($orderNumber, $amountDue), 'payment_due', $orderId);
    }

    public function buildPaymentDueMessage(string $orderNumber, string $amountDue): string
    {
        $appName = SiteSetting::get('site_name', 'Gadget & Revive');
        $template = SiteSetting::get('sms_payment_due_template', 'Your {app} order #{order} has an outstanding balance of {amount}. Please complete payment to proceed.');

        return strtr($template, ['{app}' => $appName, '{order}' => $orderNumber, '{amount}' => $amountDue]);
    }

    /** Admin's "Send Test SMS" from a specific connection — bypasses the purpose enabled/connection
     *  lookup entirely, since the whole point is to verify a connection works before assigning it
     *  to anything. */
    public function sendTest(SmsConnection $connection, string $phone, string $message, ?User $sentBy = null): bool
    {
        return $this->sendVia($connection, $phone, $message, 'test', null, $sentBy);
    }

    /**
     * Sends the same message to many recipients through one connection, logging each attempt to
     * sms_logs individually (purpose='campaign') and returning aggregate counts. Runs synchronously
     * within the request — there is no queue worker running in this deployment (see
     * deployment.md), so a "send now, watch it complete" flow is what's actually deliverable rather
     * than promising background delivery this environment can't run.
     *
     * @param  string[]  $phones
     * @return array{sent: int, failed: int}
     */
    public function sendCampaign(SmsConnection $connection, string $message, array $phones, ?int $campaignId = null, ?User $sentBy = null): array
    {
        $sent = 0;
        $failed = 0;

        foreach ($phones as $phone) {
            $ok = $this->sendVia($connection, $phone, $message, 'campaign', $campaignId, $sentBy);
            $ok ? $sent++ : $failed++;
        }

        return ['sent' => $sent, 'failed' => $failed];
    }

    /**
     * Low-level send — always attempts and always logs. Never throws: a failed SMS should never
     * break the order/auth/campaign flow that triggered it, it just gets logged as 'failed' for
     * the admin to notice.
     */
    public function sendVia(SmsConnection $connection, string $phone, string $message, string $purpose = 'other', ?int $relatedId = null, ?User $sentBy = null, ?int $campaignId = null): bool
    {
        $phone = $this->formatPhone($phone, $connection->phone_format);
        $apiUrl = trim((string) $connection->api_url);

        if ($phone === '' || $apiUrl === '') {
            SmsLog::create([
                'phone' => $phone, 'message' => $message, 'purpose' => $purpose,
                'status' => 'failed', 'response' => 'This connection is not fully configured (missing phone or API URL).',
                'related_id' => $relatedId, 'sent_by' => $sentBy?->id,
                'sms_connection_id' => $connection->id, 'sms_campaign_id' => $campaignId,
            ]);
            return false;
        }

        $method = strtoupper((string) $connection->method ?: 'GET');
        $params = [
            'api_key'   => (string) $connection->api_key,
            'sender_id' => (string) $connection->sender_id,
            'phone'     => $phone,
            'message'   => $message,
        ];

        try {
            if ($method === 'POST') {
                [$url, $body] = $this->buildPostRequest($apiUrl, $params);
                $response = Http::asForm()->timeout(15)->post($url, $body);
            } else {
                // Placeholders actually written into the template (e.g. a provider whose real
                // param name is `msg` gets configured as ...&msg={message}&to={phone}...) are
                // substituted in place. Any of the four NOT referenced in the template get
                // appended as query params under our own name as a convenience default (covers
                // the common case where a provider's param names happen to already match ours)
                // — but only those, so a provider using different names for the params it *does*
                // care about never receives a second, wrongly-named copy alongside the
                // correctly-substituted one.
                $usedKeys = array_filter(array_keys($params), fn ($k) => str_contains($apiUrl, '{' . $k . '}'));
                $url = strtr($apiUrl, array_combine(
                    array_map(fn ($k) => '{' . $k . '}', array_keys($params)),
                    array_map('rawurlencode', array_values($params))
                ));
                $extraParams = array_diff_key($params, array_flip($usedKeys));

                // Http::get($url, []) does NOT leave $url's existing query string alone — an
                // empty (but non-null) query array makes Guzzle rebuild the URI's query from
                // scratch, silently wiping out everything strtr() just substituted in. Only pass
                // a second argument at all when there's genuinely something left to add.
                $response = empty($extraParams) ? Http::timeout(15)->get($url) : Http::timeout(15)->get($url, $extraParams);
            }

            $decoded = json_decode($response->body(), true);
            $ok = $response->successful() && $this->bodyIndicatesSuccess($response->body());

            $log = SmsLog::create([
                'phone' => $phone, 'message' => $message, 'purpose' => $purpose,
                'status' => $ok ? 'sent' : 'failed',
                'response' => substr($response->body(), 0, 2000),
                'provider_request_id' => $ok ? $this->extractField($decoded, ['data.request_id', 'request_id']) : null,
                'related_id' => $relatedId, 'sent_by' => $sentBy?->id,
                'sms_connection_id' => $connection->id, 'sms_campaign_id' => $campaignId,
            ]);

            if (!$ok) {
                Log::warning("SMS send failed ({$purpose}) via connection #{$connection->id} to {$phone}: HTTP {$response->status()}");
            } elseif ($log->provider_request_id && trim((string) $connection->report_url) !== '') {
                $this->captureCost($connection, $log);
            }

            return $ok;
        } catch (\Throwable $e) {
            SmsLog::create([
                'phone' => $phone, 'message' => $message, 'purpose' => $purpose,
                'status' => 'failed', 'response' => $e->getMessage(),
                'related_id' => $relatedId, 'sent_by' => $sentBy?->id,
                'sms_connection_id' => $connection->id, 'sms_campaign_id' => $campaignId,
            ]);
            Log::error("SMS send exception ({$purpose}) via connection #{$connection->id} to {$phone}: {$e->getMessage()}");
            return false;
        }
    }

    /**
     * A POST-method connection's api_url template is authored the same way as a GET one — e.g.
     * "https://api.sms.net.bd/sendsms?api_key={api_key}&msg={message}&to={phone}" — but a real
     * POST provider (confirmed against Alpha SMS's own docs/examples) expects those values as
     * form-body fields under the provider's own names (`api_key`, `msg`, `to`), not baked into
     * the URL's query string the way a GET request would want them. Sending them in the query
     * string of a POST request left the provider unable to find `api_key` at all — every send
     * came back "405 Authorization required" regardless of whether the key was correct, which
     * one server it was sent from, so it wasn't the IP whitelisting we'd suspected.
     *
     * So for POST, the template's query string is read purely as a *name mapping* ("this
     * provider calls the api key param `api_key`, the message param `msg`") and every pair moves
     * into the body under that exact name; only something genuinely embedded in the URL *path*
     * (before the `?`) — e.g. a REST-style "/api/{api_key}/send" — gets substituted into the URL
     * itself, since that part structurally has to stay in the URL.
     *
     * @return array{0: string, 1: array<string, string>} [$url, $formBody]
     */
    private function buildPostRequest(string $apiUrl, array $params): array
    {
        [$basePath, $queryString] = array_pad(explode('?', $apiUrl, 2), 2, '');

        $placeholders = array_combine(
            array_map(fn ($k) => '{' . $k . '}', array_keys($params)),
            array_values($params)
        );

        $url = strtr($basePath, array_map('rawurlencode', $placeholders));

        $body = [];
        if ($queryString !== '') {
            foreach (explode('&', $queryString) as $pair) {
                if ($pair === '') {
                    continue;
                }
                [$key, $rawValue] = array_pad(explode('=', $pair, 2), 2, '');
                $body[$key] = strtr($rawValue, $placeholders);
            }
        }

        // Any of the four values the template never referenced at all (path or query) still get
        // sent, under our own default name — same convenience fallback as the GET path.
        $usedKeys = array_filter(array_keys($params), fn ($k) => str_contains($apiUrl, '{' . $k . '}'));
        foreach (array_diff_key($params, array_flip($usedKeys)) as $key => $value) {
            $body[$key] = $value;
        }

        return [$url, $body];
    }

    /**
     * Best-effort only — some providers (Alpha SMS included) don't return the per-message charge
     * on the send call itself, only via a separate report/status endpoint keyed by request_id.
     * Fetching it right after a successful send is what keeps the "spent per section" breakdown
     * on the SMS Center accurate without a queue worker (this deployment doesn't run one — see
     * deployment.md). Any failure here is swallowed: the send itself already succeeded and is
     * already logged, so a missing cost figure just leaves that row's cost null rather than
     * turning an already-successful send into a failure.
     */
    private function captureCost(SmsConnection $connection, SmsLog $log): void
    {
        try {
            $url = strtr($connection->report_url, [
                '{api_key}'    => rawurlencode((string) $connection->api_key),
                '{request_id}' => rawurlencode((string) $log->provider_request_id),
            ]);
            $response = Http::timeout(10)->get($url);
            $decoded = json_decode($response->body(), true);
            $cost = $this->extractField($decoded, [
                'data.request_charge', 'data.recipients.0.charge', 'data.charge', 'charge', 'cost',
            ]);

            if ($cost !== null && is_numeric($cost)) {
                $log->update(['cost' => (float) $cost]);
            }
        } catch (\Throwable $e) {
            Log::info("SMS cost lookup failed for log #{$log->id}: {$e->getMessage()}");
        }
    }

    /** First non-null value found by trying each dot-path (Arr::get syntax) against a decoded
     *  JSON body in order — different providers nest the same kind of field differently. */
    private function extractField(?array $decoded, array $paths): ?string
    {
        if (!$decoded) {
            return null;
        }

        foreach ($paths as $path) {
            $value = Arr::get($decoded, $path);
            if ($value !== null && $value !== '') {
                return (string) $value;
            }
        }

        return null;
    }

    /**
     * A 2xx HTTP status only means the provider's server accepted and understood the request —
     * many BD SMS gateways (Alpha SMS among them) always respond 200 and report the *real*
     * outcome in the JSON body instead, e.g. {"error": 0, "msg": "Success"} vs
     * {"error": 405, "msg": "Authorization required"}. Confirmed directly against Alpha SMS: an
     * invalid api_key still comes back HTTP 200, which without this check would have been logged
     * as "sent" despite never actually delivering anything.
     *
     * Deliberately conservative: only treats the response as a *failure* when it parses as JSON
     * with a numeric-ish `error` field that isn't 0 — anything else (non-JSON body, no `error`
     * key, a provider using a totally different success shape) falls through as success, so this
     * only ever narrows false "sent"s, never introduces false "failed"s for providers this wasn't
     * written against.
     */
    private function bodyIndicatesSuccess(string $body): bool
    {
        $decoded = json_decode($body, true);
        if (!is_array($decoded) || !array_key_exists('error', $decoded)) {
            return true;
        }

        return ((int) $decoded['error']) === 0;
    }

    /**
     * 'as_is' leaves the stored number untouched; 'bd_880' normalizes a local 11-digit
     * (01XXXXXXXXX) number to the 880XXXXXXXXXX form most BD gateways expect, since customer_phone
     * is stored however the customer typed it and providers are inconsistent about accepting both.
     */
    private function formatPhone(string $phone, string $strategy): string
    {
        $phone = preg_replace('/[^0-9+]/', '', trim($phone)) ?? '';

        if ($strategy !== 'bd_880') {
            return $phone;
        }

        $digits = ltrim($phone, '+');
        if (str_starts_with($digits, '880')) {
            return $digits;
        }
        if (str_starts_with($digits, '0')) {
            return '880' . substr($digits, 1);
        }
        if (strlen($digits) === 10) {
            return '880' . $digits;
        }

        return $digits;
    }
}
