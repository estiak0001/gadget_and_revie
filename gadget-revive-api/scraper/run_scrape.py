"""CLI driver for the admin's "Run Scraper" button (see ScrapeRunController::launch()).

This is deliberately NOT a reimplementation of the scraper. On every single run it:
  1. Reads startech_scrap.ipynb fresh via nbformat and concatenates its code cells.
  2. Regex-patches only the known config-variable assignment lines (CATEGORY_URL, CATEGORY_NAME,
     BRAND_FILTER, PRODUCT_LIMIT, TEMPLATE_CATEGORY, API_BASE_URL, API_TOKEN, BATCH_NAME) with the
     values passed on the command line.
  3. Runs the patched script as a subprocess and relays its result.

There is therefore only ever one copy of the scraping logic -- editing the notebook by hand (a
selector fix, a new field) automatically applies here too, with nothing to keep in sync. The
notebook itself is never modified by this script; it only ever reads it.

Must be run on a machine startech.com.bd hasn't Cloudflare-blocked -- see
ScrapedProductController's class docblock. ScrapeRunController launches this detached
(`nohup ... & echo $!`) and expects it to report back via --callback-url exactly once, which the
try/finally below guarantees even if something above it throws.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

# nbformat is imported lazily inside build_patched_script(), not here at module level -- a
# missing dependency must still reach main()'s try/except/finally and get reported through the
# callback, not crash before argparse/the callback URL are even available. The callback itself
# uses only the stdlib (urllib) for the same reason: it must still work even if a third-party
# package this script would otherwise use is missing from this machine's python environment.


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run-id", required=True)
    p.add_argument("--category-url", required=True)
    p.add_argument("--category-name", required=True)
    p.add_argument("--template-category", required=True)
    p.add_argument("--brand-filter", default=None)
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--batch", required=True)
    p.add_argument("--api-base-url", required=True)
    p.add_argument("--api-token", required=True)
    p.add_argument("--callback-url", required=True)
    p.add_argument("--notebook-path", required=True)
    p.add_argument("--timeout", type=int, default=7200)
    # Passed through explicitly rather than trusting sys.executable, which this environment has
    # shown can resolve to an empty string depending on how the process tree above it was
    # spawned (confirmed: subprocess.run([sys.executable, ...]) raised
    # "PermissionError: [Errno 13] Permission denied: ''" when launched from a detached
    # nohup'd child of a Laravel dev-server request, while every other invocation path worked
    # fine) -- an explicit, known-good interpreter path sidesteps that entirely.
    p.add_argument("--python-bin", default=None)
    return p.parse_args()


def patch_line(source: str, var_name: str, new_literal: str) -> str:
    """Replaces the single top-level `VAR = ...` assignment line with a new literal value.
    Raises if the notebook no longer has that line -- a loud failure beats silently scraping
    with the notebook's own hardcoded default when the caller explicitly asked for something
    else."""
    pattern = re.compile(rf"^{re.escape(var_name)}\s*=.*$", re.MULTILINE)
    if not pattern.search(source):
        raise RuntimeError(f"Could not find a '{var_name} = ...' line to patch in the notebook.")
    return pattern.sub(f"{var_name} = {new_literal}", source, count=1)


def build_patched_script(args) -> str:
    import nbformat  # see the module docstring for why this is a lazy, not top-level, import.

    nb = nbformat.read(args.notebook_path, as_version=4)
    source = "\n\n".join(cell.source for cell in nb.cells if cell.cell_type == "code")

    source = patch_line(source, "CATEGORY_URL", repr(args.category_url))
    source = patch_line(source, "CATEGORY_NAME", repr(args.category_name))
    source = patch_line(source, "TEMPLATE_CATEGORY", repr(args.template_category))
    source = patch_line(source, "API_BASE_URL", repr(args.api_base_url))
    source = patch_line(source, "API_TOKEN", repr(args.api_token))
    source = patch_line(source, "BATCH_NAME", repr(args.batch))
    if args.brand_filter:
        source = patch_line(source, "BRAND_FILTER", repr(args.brand_filter))
    if args.limit:
        source = patch_line(source, "PRODUCT_LIMIT", str(args.limit))

    return source


def run_patched_script(source: str, timeout: int, python_bin: str):
    """Returns (breakdown_dict_or_None, error_message_or_None)."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as tf:
            tf.write(source)
            tmp_path = tf.name

        proc = subprocess.run(
            [python_bin, tmp_path],
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        match = re.search(r"INGEST_BREAKDOWN::(\{.*\})", proc.stdout)
        if match:
            return json.loads(match.group(1)), None

        tail = (proc.stderr or proc.stdout or "").strip()[-4000:]
        if proc.returncode != 0:
            return None, tail or f"Script exited with code {proc.returncode} and no output."
        return None, "Script finished but produced no result summary -- it may not have reached send_to_admin()."
    except subprocess.TimeoutExpired:
        return None, f"Timed out after {timeout} seconds."
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def main():
    args = parse_args()
    payload = {"status": "failed", "error_message": "Unknown error before the scraper could start."}

    try:
        source = build_patched_script(args)
        python_bin = args.python_bin or sys.executable
        breakdown, error_message = run_patched_script(source, args.timeout, python_bin)
        if breakdown is not None:
            payload = {
                "status": "completed",
                "created": breakdown.get("created", 0),
                "updated": breakdown.get("updated", 0),
                "synced": breakdown.get("synced", 0),
                "skipped": breakdown.get("skipped", 0) + breakdown.get("duplicate", 0),
                "failed": breakdown.get("failed", 0),
            }
        else:
            payload = {"status": "failed", "error_message": error_message}
    except Exception as e:  # noqa: BLE001 -- deliberately broad: any failure must still callback.
        import traceback

        print(traceback.format_exc(), file=sys.stderr)  # lands in the per-run log file.
        payload = {"status": "failed", "error_message": f"{type(e).__name__}: {e}"}
    finally:
        try:
            req = urllib.request.Request(
                args.callback_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {args.api_token}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            urllib.request.urlopen(req, timeout=30)
        except Exception:
            # Best-effort -- if even the callback fails, ScrapeRunController::show()'s stale-PID
            # check eventually marks the run failed on its own next poll.
            pass


if __name__ == "__main__":
    main()
