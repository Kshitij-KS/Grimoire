"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/browser";

/**
 * PostHog analytics provider with lazy initialization after hydration.
 * - Cookieless mode (persistence: 'memory', autocapture: false)
 * - Identifies authenticated user with ID and plan tier
 * - All operations wrapped in try-catch with silent failure
 * - Initialization guaranteed within 3 seconds of mount
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!posthogKey) return;

    let initTimeout: ReturnType<typeof setTimeout> | null = null;

    const initialize = () => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      try {
        posthog.init(posthogKey, {
          api_host: posthogHost || "https://us.i.posthog.com",
          persistence: "memory",
          autocapture: false,
          capture_pageview: false,
          loaded: (ph) => {
            identifyUser(ph);
          },
        });
      } catch {
        // Silent failure — analytics must never break the app
      }
    };

    // 3-second fallback to ensure init happens within time limit
    initTimeout = setTimeout(() => {
      initialize();
    }, 3000);

    // Attempt immediate initialization after hydration
    // requestIdleCallback for optimal timing, falling back to rAF
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => {
        if (!initializedRef.current) {
          initialize();
          if (initTimeout) clearTimeout(initTimeout);
        }
      });
    } else {
      requestAnimationFrame(() => {
        if (!initializedRef.current) {
          initialize();
          if (initTimeout) clearTimeout(initTimeout);
        }
      });
    }

    return () => {
      if (initTimeout) clearTimeout(initTimeout);
    };
  }, []);

  return <>{children}</>;
}

/**
 * Identifies the authenticated user with PostHog using their ID and plan tier.
 */
async function identifyUser(ph: { identify: (id: string, properties?: Record<string, unknown>) => void }): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    const userId = session.user.id;

    // Fetch plan tier from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", userId)
      .maybeSingle();

    const plan = profile?.plan ?? "free";

    ph.identify(userId, { plan });
  } catch {
    // Silent failure — analytics identification must never break the app
  }
}
