"""
evaluator.py

Wraps lm_eval.simple_evaluate() to evaluate Groq models using the
`local-chat-completions` model type (OpenAI-compatible API).

Key design:
- Runs in a background thread (non-blocking for the FastAPI server)
- Calls the Next.js webhook on completion to persist results
- Handles all error cases gracefully
"""
import threading
import traceback
import logging
import os
from typing import Optional

import httpx
import lm_eval

from groq_adapter import configure_groq_env, GROQ_BASE_URL, get_tokenizer_for_model

logger = logging.getLogger(__name__)

# ── In-memory run state (for /status polling) ──────────────────────────────
_run_states: dict[str, dict] = {}
_states_lock = threading.Lock()


def get_run_state(run_id: str) -> Optional[dict]:
    with _states_lock:
        return _run_states.get(run_id)


def _set_run_state(run_id: str, state: dict) -> None:
    with _states_lock:
        _run_states[run_id] = state


# ── Core evaluation logic ──────────────────────────────────────────────────

def _do_evaluate(
    run_id: str,
    model_name: str,
    tasks: list[str],
    num_samples: int,
    groq_api_key: str,
    webhook_url: str,
) -> None:
    """
    Run lm_eval in a background thread, then POST results to the Next.js webhook.
    """
    _set_run_state(run_id, {"status": "running", "run_id": run_id})

    try:
        # Configure Groq as the OpenAI-compatible endpoint
        configure_groq_env(groq_api_key)
        tokenizer = get_tokenizer_for_model(model_name)

        logger.info(f"[{run_id}] Starting eval: model={model_name}, tasks={tasks}, samples={num_samples}")

        results = lm_eval.simple_evaluate(
            model="local-chat-completions",
            model_args={
                "model": model_name,
                "base_url": GROQ_BASE_URL,
                "tokenizer": tokenizer,
                "num_concurrent": 1,   # respect Groq's rate limits
                "timeout": 60,
                "tokenized_requests": False,
            },
            tasks=tasks,
            limit=num_samples,
            apply_chat_template=True,
            log_samples=False,
            verbosity="INFO",
        )

        # Flatten results into a list of { task, metric, value, stderr }
        flat_results = _flatten_results(results.get("results", {}))

        logger.info(f"[{run_id}] Evaluation complete. {len(flat_results)} metric rows.")
        _set_run_state(run_id, {"status": "completed", "run_id": run_id, "results": flat_results})

        # Notify Next.js
        _post_webhook(webhook_url, run_id, "completed", flat_results, None)

    except Exception as exc:
        error_msg = traceback.format_exc()
        logger.error(f"[{run_id}] Evaluation failed: {error_msg}")
        _set_run_state(run_id, {"status": "failed", "run_id": run_id, "error": str(exc)})
        _post_webhook(webhook_url, run_id, "failed", [], str(exc))


def _flatten_results(raw_results: dict) -> list[dict]:
    """
    Convert lm-eval's nested results dict into a flat list suitable for DB storage.

    lm-eval returns:
      { "arc_easy": { "acc,none": 0.74, "acc_stderr,none": 0.009, ... }, ... }

    We convert to:
      [
        { "task_name": "arc_easy", "metric_name": "acc", "metric_value": 0.74, "stderr": 0.009 },
        ...
      ]
    """
    flat: list[dict] = []
    for task_name, metrics in raw_results.items():
        # Build a stderr lookup: metric_name → stderr_value
        stderr_lookup: dict[str, float] = {}
        for key, val in metrics.items():
            if "_stderr," in key and isinstance(val, (int, float)):
                base_metric = key.replace("_stderr,", ",").split(",")[0]
                stderr_lookup[base_metric] = float(val)

        for key, val in metrics.items():
            # Skip stderr rows themselves and non-numeric values (e.g. "alias")
            if "_stderr," in key or not isinstance(val, (int, float)):
                continue
            # key format: "acc,none" or "acc_norm,none"
            metric_name = key.split(",")[0]
            stderr = stderr_lookup.get(metric_name)
            flat.append({
                "task_name": task_name,
                "metric_name": metric_name,
                "metric_value": float(val),
                "stderr": stderr,
            })
    return flat


def _post_webhook(
    webhook_url: str,
    run_id: str,
    status: str,
    results: list[dict],
    error_message: Optional[str],
) -> None:
    """POST completion payload to the Next.js webhook endpoint."""
    try:
        webhook_secret = os.getenv("WEBHOOK_SECRET", "")
        payload = {
            "runId": run_id,
            "status": status,
            "results": results,
            "errorMessage": error_message,
        }
        headers = {}
        if webhook_secret:
            headers["x-eval-webhook-secret"] = webhook_secret

        with httpx.Client(timeout=30) as client:
            resp = client.post(webhook_url, json=payload, headers=headers)
            resp.raise_for_status()
            logger.info(f"[{run_id}] Webhook acknowledged: {resp.status_code}")
    except Exception as e:
        # Non-fatal — results are still in-memory via _run_states
        logger.warning(f"[{run_id}] Webhook POST failed (non-fatal): {e}")


# ── Public API ─────────────────────────────────────────────────────────────

def start_evaluation(
    run_id: str,
    model_name: str,
    tasks: list[str],
    num_samples: int,
    groq_api_key: str,
    webhook_url: str,
) -> None:
    """
    Kick off evaluation in a daemon background thread and return immediately.
    The caller can poll get_run_state(run_id) or wait for the webhook.
    """
    _set_run_state(run_id, {"status": "pending", "run_id": run_id})
    thread = threading.Thread(
        target=_do_evaluate,
        args=(run_id, model_name, tasks, num_samples, groq_api_key, webhook_url),
        daemon=True,
        name=f"eval-{run_id[:8]}",
    )
    thread.start()
    logger.info(f"[{run_id}] Background evaluation thread started.")
