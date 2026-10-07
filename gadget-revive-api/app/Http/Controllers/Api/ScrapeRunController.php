<?php

namespace App\Http\Controllers\Api;

use App\Models\ScrapeRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;

/**
 * Triggers and tracks a web-initiated run of scraper/run_scrape.py, which regenerates and
 * executes startech_scrap.ipynb's own code fresh every time (never a hand-duplicated copy of
 * the scraping logic -- see that script's docblock). This never runs on the live production
 * server: startech.com.bd Cloudflare-blocks that server's IP (see ScrapedProductController's
 * class docblock), so store() only actually succeeds where the API process itself has an
 * unblocked IP, i.e. run locally.
 *
 * No queue worker exists anywhere in this app (confirmed -- QUEUE_CONNECTION is unused today),
 * so the script is launched as a detached `nohup ... & echo $!` background process rather than
 * a queued job: it needs no worker to keep running or to be picked up. It reports back when
 * done via complete() below, using the same short-lived admin token it was handed to call
 * /admin/scraped-products/ingest with -- no separate auth mechanism.
 */
class ScrapeRunController extends BaseController
{
    public function index(): JsonResponse
    {
        $runs = ScrapeRun::with('triggeredBy')->orderByDesc('id')->limit(20)->get();

        return $this->success($runs);
    }

    public function show(int $id): JsonResponse
    {
        $run = ScrapeRun::with('triggeredBy')->findOrFail($id);
        $this->markStaleIfAbandoned($run);

        return $this->success($run);
    }

    /**
     * Defensive fallback for the (hopefully rare) case where the script crashes hard enough to
     * never reach its own try/finally callback -- e.g. OOM-killed. Only kicks in once a run has
     * looked "running" for a while with no update, and only flips it once the OS confirms the
     * PID is actually gone (never guesses while it might still legitimately be working).
     */
    private function markStaleIfAbandoned(ScrapeRun $run): void
    {
        if ($run->status !== 'running' || $run->updated_at->gt(now()->subMinutes(30))) {
            return;
        }

        $alive = $run->pid && function_exists('posix_kill') && posix_kill($run->pid, 0);
        if (!$alive) {
            $run->update([
                'status' => 'failed',
                'error_message' => 'Process ended without reporting completion (crashed or killed).',
                'finished_at' => now(),
            ]);
        }
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_url' => 'required|url|max:2048',
            'category_name' => 'required|string|max:191',
            'template_category' => 'required|string|max:191',
            'brand_filter' => 'nullable|string|max:191',
            'product_limit' => 'nullable|integer|min:1|max:5000',
        ]);

        $admin = $request->user();
        $batch = Str::slug($data['category_name']) . '-' . now()->format('Ymd-His');

        $run = ScrapeRun::create([
            'category_url' => $data['category_url'],
            'category_name' => $data['category_name'],
            'brand_filter' => $data['brand_filter'] ?? null,
            'product_limit' => $data['product_limit'] ?? null,
            'template_category' => $data['template_category'],
            'batch' => $batch,
            'status' => 'running',
            'triggered_by' => $admin->id,
            'started_at' => now(),
        ]);

        $token = $admin->createToken("scrape-run-{$run->id}")->plainTextToken;
        $baseUrl = rtrim($request->getSchemeAndHttpHost(), '/');

        $pid = $this->launch($run, $data, $batch, $token, $baseUrl);
        $run->update(['pid' => $pid]);

        return $this->created($run, 'Scrape started');
    }

    /** Builds and launches the detached python process; returns its PID (or null if it couldn't be read). */
    private function launch(ScrapeRun $run, array $data, string $batch, string $token, string $baseUrl): ?int
    {
        $args = [
            '--run-id=' . $run->id,
            '--category-url=' . $data['category_url'],
            '--category-name=' . $data['category_name'],
            '--template-category=' . $data['template_category'],
            '--batch=' . $batch,
            '--api-base-url=' . $baseUrl . '/api',
            '--api-token=' . $token,
            '--callback-url=' . $baseUrl . "/api/admin/scrape-runs/{$run->id}/complete",
            '--notebook-path=' . config('scraper.notebook_path'),
            '--timeout=' . config('scraper.timeout'),
            // Passed explicitly rather than letting the script fall back to its own
            // sys.executable -- confirmed unreliable (can resolve to an empty string) once this
            // runs several process-generations deep inside a detached nohup child.
            '--python-bin=' . config('scraper.python_bin'),
        ];
        if (!empty($data['brand_filter'])) {
            $args[] = '--brand-filter=' . $data['brand_filter'];
        }
        if (!empty($data['product_limit'])) {
            $args[] = '--limit=' . $data['product_limit'];
        }

        $logPath = storage_path("logs/scrape-run-{$run->id}.log");

        // The trailing "& echo $!" (inside one /bin/sh -c string, which is how Laravel's Process
        // facade runs a plain string command) is what makes the child immune to this request's
        // own process ending -- not any guarantee about a Process object's lifecycle. nohup
        // additionally protects it from SIGHUP if the parent shell session itself ever closes.
        $command = sprintf(
            'nohup %s %s %s > %s 2>&1 & echo $!',
            escapeshellarg(config('scraper.python_bin')),
            escapeshellarg(base_path('scraper/run_scrape.py')),
            implode(' ', array_map('escapeshellarg', $args)),
            escapeshellarg($logPath)
        );

        $result = Process::run($command);
        $pid = (int) trim($result->output());

        return $pid > 0 ? $pid : null;
    }

    /**
     * Called by run_scrape.py itself when it finishes (success or failure) -- authenticated as
     * the same admin via the short-lived token minted in store(), which this always revokes
     * before returning so it never outlives the run it was created for.
     */
    public function complete(Request $request, int $id): JsonResponse
    {
        $run = ScrapeRun::findOrFail($id);

        $data = $request->validate([
            'status' => 'required|in:completed,failed',
            'created' => 'nullable|integer|min:0',
            'updated' => 'nullable|integer|min:0',
            'synced' => 'nullable|integer|min:0',
            'skipped' => 'nullable|integer|min:0',
            'failed' => 'nullable|integer|min:0',
            'error_message' => 'nullable|string',
        ]);

        $run->update([
            'status' => $data['status'],
            'created_count' => $data['created'] ?? null,
            'updated_count' => $data['updated'] ?? null,
            'synced_count' => $data['synced'] ?? null,
            'skipped_count' => $data['skipped'] ?? null,
            'failed_count' => $data['failed'] ?? null,
            'error_message' => $data['error_message'] ?? null,
            'finished_at' => now(),
        ]);

        $request->user()->tokens()->where('name', "scrape-run-{$run->id}")->delete();

        return $this->success($run, 'Recorded');
    }
}
