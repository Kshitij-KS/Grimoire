// Route-handler tests for POST /api/eval/webhook (Req 9.1, 9.3).
//
// Uses a hand-rolled chainable Supabase stub (per the design testing strategy)
// returned from a mocked `createAdminSupabaseClient`, since the handler drives
// the fluent query builder against `eval_runs`/`eval_results` rather than raw
// HTTP. `EVAL_WEBHOOK_SECRET` is controlled via `vi.stubEnv` and restored after
// each test.
//
// Coverage:
//  - 503 when `EVAL_WEBHOOK_SECRET` is unset (fail closed, Req 9.1);
//  - 403 when the presented secret does not match (Req 9.3);
//  - success (auth gate passed) when the presented secret matches.

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// `@/lib/api` (imported by the route for `jsonError`) transitively pulls in
// `@/lib/supabase/server` → `@/lib/env` → `server-only`, which is unavailable
// under the node test environment. Mocking the server client short-circuits
// that chain (the handler only uses the admin client at runtime).
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(),
}));

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { POST } from "@/app/api/eval/webhook/route";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const SECRET = "s3cr3t-webhook-token";

/**
 * Chainable admin Supabase stub: the run exists and is in a pending state so
 * the handler proceeds past the auth gate and updates it successfully.
 */
function makeAdminStub() {
  function resolve(table: string, op: string): { data?: unknown; error: unknown } {
    if (table === "eval_runs" && op === "select") {
      return { data: { id: RUN_ID, status: "running" }, error: null };
    }
    // update on eval_runs, insert on eval_results
    return { data: null, error: null };
  }

  function makeBuilder(table: string) {
    let op = "select";
    const builder: Record<string, unknown> = {
      select: () => { op = "select"; return builder; },
      insert: () => { op = "insert"; return Promise.resolve(resolve(table, "insert")); },
      update: () => { op = "update"; return builder; },
      eq: () => builder,
      single: () => Promise.resolve(resolve(table, op)),
      maybeSingle: () => Promise.resolve(resolve(table, op)),
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolve(table, op)).then(onFulfilled, onRejected),
    };
    return builder;
  }

  const client = {
    from: vi.fn((table: string) => makeBuilder(table)),
  };

  return { client };
}

function webhookRequest(secretHeader?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secretHeader !== undefined) {
    headers["x-eval-webhook-secret"] = secretHeader;
  }
  return new Request("http://localhost/api/eval/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify({
      runId: RUN_ID,
      status: "completed",
      results: [
        { task_name: "task-a", metric_name: "accuracy", metric_value: 0.9 },
      ],
    }),
  });
}

describe("POST /api/eval/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 when EVAL_WEBHOOK_SECRET is unset (fail closed)", async () => {
    vi.stubEnv("EVAL_WEBHOOK_SECRET", "");
    const { client } = makeAdminStub();
    vi.mocked(createAdminSupabaseClient).mockReturnValue(client as never);

    const response = await POST(webhookRequest(SECRET));

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("Webhook not configured");
  });

  it("returns 403 when the presented secret does not match", async () => {
    vi.stubEnv("EVAL_WEBHOOK_SECRET", SECRET);
    const { client } = makeAdminStub();
    vi.mocked(createAdminSupabaseClient).mockReturnValue(client as never);

    const response = await POST(webhookRequest("wrong-secret"));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  it("passes the auth gate and succeeds when the presented secret matches", async () => {
    vi.stubEnv("EVAL_WEBHOOK_SECRET", SECRET);
    const { client } = makeAdminStub();
    vi.mocked(createAdminSupabaseClient).mockReturnValue(client as never);

    const response = await POST(webhookRequest(SECRET));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.runId).toBe(RUN_ID);
    expect(body.status).toBe("completed");
  });
});
