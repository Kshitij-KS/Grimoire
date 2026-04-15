import { describe, expect, it, vi } from "vitest";
import { checkAndIncrement } from "@/lib/rate-limit";

describe("checkAndIncrement", () => {
  it("returns limiter response when rpc succeeds", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: true, count: 3, limit: 50 }],
      error: null,
    });
    const supabase = { rpc } as unknown as Parameters<typeof checkAndIncrement>[0];

    const result = await checkAndIncrement(supabase, "user-1", "chat_message", 50);

    expect(rpc).toHaveBeenCalledWith("increment_rate_limit", {
      p_user_id: "user-1",
      p_action: "chat_message",
      p_limit: 50,
    });
    expect(result).toEqual({ allowed: true, count: 3, limit: 50 });
  });

  it("fails closed when rpc fails", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });
    const supabase = { rpc } as unknown as Parameters<typeof checkAndIncrement>[0];

    const result = await checkAndIncrement(supabase, "user-2", "chat_message", 10);

    expect(result).toEqual({ allowed: false, count: 10, limit: 10 });
  });
});
