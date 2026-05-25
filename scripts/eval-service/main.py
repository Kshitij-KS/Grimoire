"""
main.py — FastAPI sidecar for lm-evaluation-harness

Endpoints:
  POST /run             Start a new evaluation run
  GET  /status/{runId}  Poll run status (in-memory)
  GET  /tasks           List available lm-eval task names
  GET  /health          Health check

The sidecar is called by the Next.js API route at /api/eval/runs.
It runs lm_eval in a background thread and posts results back to
the Next.js webhook at /api/eval/webhook when complete.

Usage:
  cd scripts/eval-service
  python main.py

Or via npm: npm run eval:service
"""
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import evaluator

# ── Bootstrap ──────────────────────────────────────────────────────────────
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("eval-service")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")
NEXTJS_BASE_URL = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
SIDECAR_SECRET = os.getenv("SIDECAR_SECRET", "")   # shared secret with Next.js

# Tasks we expose to users (safe subset of all lm-eval tasks)
SUPPORTED_TASKS = [
    {"id": "arc_easy",       "label": "ARC Easy",        "category": "Reasoning",     "approxSamples": 2376},
    {"id": "arc_challenge",  "label": "ARC Challenge",   "category": "Reasoning",     "approxSamples": 1172},
    {"id": "hellaswag",      "label": "HellaSwag",       "category": "Common Sense",  "approxSamples": 10042},
    {"id": "winogrande",     "label": "Winogrande",      "category": "Common Sense",  "approxSamples": 1267},
    {"id": "truthfulqa_mc1", "label": "TruthfulQA (MC1)","category": "Knowledge",     "approxSamples": 817},
    {"id": "mmlu",           "label": "MMLU (Full)",     "category": "Knowledge",     "approxSamples": 14042},
    {"id": "boolq",          "label": "BoolQ",           "category": "Reasoning",     "approxSamples": 3270},
    {"id": "piqa",           "label": "PIQA",            "category": "Common Sense",  "approxSamples": 1838},
]


# ── FastAPI app ────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("lm-eval sidecar starting up...")
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is not set! Evaluations will fail.")
    yield
    logger.info("lm-eval sidecar shutting down.")

app = FastAPI(
    title="Grimoire lm-eval Sidecar",
    description="Evaluation harness integration for Grimoire's model benchmarking feature",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ── Auth helper ────────────────────────────────────────────────────────────

def require_sidecar_auth(x_sidecar_secret: Optional[str] = Header(None)) -> None:
    """Validate shared secret sent by Next.js. Skip check if secret not configured."""
    if SIDECAR_SECRET and x_sidecar_secret != SIDECAR_SECRET:
        raise HTTPException(status_code=401, detail="Invalid sidecar secret")


# ── Request / Response models ──────────────────────────────────────────────

class RunRequest(BaseModel):
    runId: str = Field(..., description="UUID of the eval_runs row already created in Supabase")
    modelName: str = Field(..., description="Groq model name, e.g. 'llama-3.3-70b-versatile'")
    tasks: list[str] = Field(..., min_length=1, description="List of lm-eval task names")
    numSamples: int = Field(default=50, ge=5, le=500, description="Max samples per task")

class RunResponse(BaseModel):
    runId: str
    status: str
    message: str

class StatusResponse(BaseModel):
    runId: str
    status: str
    error: Optional[str] = None


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "groqKeyConfigured": bool(GROQ_API_KEY),
        "webhookTarget": f"{NEXTJS_BASE_URL}/api/eval/webhook",
    }


@app.get("/tasks")
async def list_tasks():
    """Return the list of supported benchmark tasks."""
    return {"tasks": SUPPORTED_TASKS}


@app.post("/run", response_model=RunResponse)
async def start_run(
    body: RunRequest,
    x_sidecar_secret: Optional[str] = Header(None),
):
    require_sidecar_auth(x_sidecar_secret)

    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured on sidecar")

    # Validate tasks
    supported_ids = {t["id"] for t in SUPPORTED_TASKS}
    invalid = [t for t in body.tasks if t not in supported_ids]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unsupported tasks: {invalid}")

    webhook_url = f"{NEXTJS_BASE_URL}/api/eval/webhook"

    # Start background evaluation (non-blocking)
    evaluator.start_evaluation(
        run_id=body.runId,
        model_name=body.modelName,
        tasks=body.tasks,
        num_samples=body.numSamples,
        groq_api_key=GROQ_API_KEY,
        webhook_url=webhook_url,
    )

    return RunResponse(
        runId=body.runId,
        status="running",
        message=f"Evaluation started with {len(body.tasks)} task(s) and {body.numSamples} samples each.",
    )


@app.get("/status/{run_id}", response_model=StatusResponse)
async def get_status(run_id: str, x_sidecar_secret: Optional[str] = Header(None)):
    require_sidecar_auth(x_sidecar_secret)
    state = evaluator.get_run_state(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found in this process")
    return StatusResponse(
        runId=run_id,
        status=state.get("status", "unknown"),
        error=state.get("error"),
    )


# ── Entrypoint ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("EVAL_SERVICE_PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False, log_level="info")
