export const DAILY_LIMITS = {
  chat_message: 5,
  lore_ingest: 10,
  autocomplete: 30, // bounds per-user Groq autocomplete spend
  consistency_check: 5,
  soul_generate: 3,
  tavern_message: 30,
  narrator_action: 20,
  world_export: 5,
  eval_run: 3, // max benchmark evaluation runs per day
} as const;

export const EXPORT_MIN_INTERVAL_MS = 60 * 1000; // 1 minute minimum between exports

export const FREE_TIER_LIMITS = {
  worlds: 1,
  soulsPerWorld: 3,
  loreEntries: 50,
  /** Max souls in a single Tavern session on the free plan. Pro unlocks up to 4. */
  tavernSouls: 3,
  /** Absolute maximum souls in a Tavern session (pro cap). */
  tavernSoulsPro: 4,
} as const;

export const WORLD_SECTIONS = [
  "lore",
  "bible",
  "souls",
  "consistency",
  "tapestry",
  "tavern",
  "narrator",
] as const;

export type WorldSection = (typeof WORLD_SECTIONS)[number];

export const SECTION_LABELS: Record<WorldSection, string> = {
  lore: "Lore Scribe",
  bible: "The Archive",
  souls: "Bound Souls",
  consistency: "Narrator's Eye",
  tapestry: "The Tapestry",
  tavern: "The Tavern",
  narrator: "Narrator's Tools",
};

export const SEMANTIC_CACHE_THRESHOLD = 0.98;
export const MAX_INNGEST_RETRIES = 3;
export const CHUNK_SIZE_WORDS = 400;
export const AUTOCOMPLETE_WORD_COUNT = 15;

// ── lm-evaluation-harness constants ──────────────────────────────────────

export const SUPPORTED_EVAL_TASKS = [
  { id: "arc_easy",       label: "ARC Easy",        category: "Reasoning",    approxSamples: 2376  },
  { id: "arc_challenge",  label: "ARC Challenge",   category: "Reasoning",    approxSamples: 1172  },
  { id: "hellaswag",      label: "HellaSwag",       category: "Common Sense", approxSamples: 10042 },
  { id: "winogrande",     label: "Winogrande",      category: "Common Sense", approxSamples: 1267  },
  { id: "truthfulqa_mc1", label: "TruthfulQA",      category: "Knowledge",    approxSamples: 817   },
  { id: "mmlu",           label: "MMLU (Full)",     category: "Knowledge",    approxSamples: 14042 },
  { id: "boolq",          label: "BoolQ",           category: "Reasoning",    approxSamples: 3270  },
  { id: "piqa",           label: "PIQA",            category: "Common Sense", approxSamples: 1838  },
] as const;

export type EvalTaskId = (typeof SUPPORTED_EVAL_TASKS)[number]["id"];

export const EVAL_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Heavy)", description: "Most capable — slower, higher quality" },
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B (Fast)",   description: "Ultra-fast streaming model"            },
] as const;

export type EvalModelId = (typeof EVAL_MODELS)[number]["id"];

/** Default number of samples per task for eval runs (balances cost vs. accuracy). */
export const EVAL_DEFAULT_SAMPLES = 50;

/** Port the Python FastAPI sidecar listens on. */
export const EVAL_SIDECAR_PORT = 8001;
export const EVAL_SIDECAR_URL = `http://localhost:${EVAL_SIDECAR_PORT}`;
