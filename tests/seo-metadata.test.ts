import { describe, expect, it, vi } from "vitest";

// Mock component imports for app/page.tsx
vi.mock("@/components/landing/landing-page", () => ({
  LandingPage: () => null,
}));

// Mock component/data imports for app/demo/page.tsx
vi.mock("@/components/worlds/world-workspace", () => ({
  WorldWorkspace: () => null,
}));
vi.mock("@/lib/data", () => ({
  getDemoData: vi.fn(),
  getWorldWorkspaceData: vi.fn(),
}));

// ─── Landing Page Metadata ──────────────────────────────────────────────────

describe("Landing page metadata", () => {
  it("has all required Open Graph fields", async () => {
    const { metadata } = await import("@/app/page");

    expect(metadata.openGraph).toBeDefined();
    const og = metadata.openGraph as Record<string, unknown>;

    expect(og.title).toBeDefined();
    expect(og.description).toBeDefined();
    expect(og.url).toBeDefined();
    expect(og.images).toBeDefined();
    expect(og.type).toBe("website");

    // Verify URL is absolute
    expect(og.url).toMatch(/^https?:\/\//);

    // Verify image is absolute URL
    const images = og.images as Array<{ url: string }>;
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].url).toMatch(/^https?:\/\//);
  });

  it("has all required Twitter Card fields", async () => {
    const { metadata } = await import("@/app/page");

    expect(metadata.twitter).toBeDefined();
    const twitter = metadata.twitter as Record<string, unknown>;

    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.title).toBeDefined();
    expect(twitter.description).toBeDefined();
    expect(twitter.images).toBeDefined();

    // Verify image is absolute URL
    const images = twitter.images as string[];
    expect(images.length).toBeGreaterThan(0);
    expect(images[0]).toMatch(/^https?:\/\//);
  });

  it("has a canonical URL", async () => {
    const { metadata } = await import("@/app/page");

    expect(metadata.alternates).toBeDefined();
    expect(metadata.alternates?.canonical).toMatch(/^https?:\/\//);
  });

  it("has a title and description", async () => {
    const { metadata } = await import("@/app/page");

    expect(metadata.title).toBeDefined();
    expect(metadata.description).toBeDefined();
    expect(typeof metadata.description).toBe("string");
    expect((metadata.description as string).length).toBeGreaterThanOrEqual(50);
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
  });
});

// ─── Demo Page Metadata ─────────────────────────────────────────────────────

describe("Demo page metadata", () => {
  it("has a distinct description from the landing page", async () => {
    const { metadata: landingMeta } = await import("@/app/page");
    const { metadata: demoMeta } = await import("@/app/demo/page");

    expect(demoMeta.description).toBeDefined();
    expect(demoMeta.description).not.toBe(landingMeta.description);
  });

  it("has correct og:title referencing Ashveil", async () => {
    const { metadata } = await import("@/app/demo/page");

    const og = metadata.openGraph as Record<string, unknown>;
    expect(og.title).toBeDefined();
    expect(typeof og.title).toBe("string");
    expect((og.title as string).toLowerCase()).toContain("ashveil");
  });

  it("has all required Open Graph fields", async () => {
    const { metadata } = await import("@/app/demo/page");

    const og = metadata.openGraph as Record<string, unknown>;
    expect(og.title).toBeDefined();
    expect(og.description).toBeDefined();
    expect(og.url).toBeDefined();
    expect(og.images).toBeDefined();
    expect(og.type).toBe("website");

    // Verify URL is absolute and points to /demo
    expect(og.url).toMatch(/^https?:\/\/.*\/demo$/);
  });

  it("has Twitter Card fields", async () => {
    const { metadata } = await import("@/app/demo/page");

    const twitter = metadata.twitter as Record<string, unknown>;
    expect(twitter.card).toBe("summary_large_image");
    expect(twitter.title).toBeDefined();
    expect(twitter.description).toBeDefined();
    expect(twitter.images).toBeDefined();
  });
});

// ─── robots.txt ─────────────────────────────────────────────────────────────

describe("robots.txt", () => {
  it("has correct allow and disallow rules", async () => {
    const { default: robots } = await import("@/app/robots");
    const result = robots();

    expect(result.rules).toBeDefined();

    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const mainRule = rules.find(
      (r) => r.userAgent === "*" || r.userAgent?.includes("*"),
    );
    expect(mainRule).toBeDefined();

    // Check allow rules
    const allow = Array.isArray(mainRule!.allow)
      ? mainRule!.allow
      : [mainRule!.allow];
    expect(allow).toContain("/");
    expect(allow).toContain("/demo");

    // Check disallow rules
    const disallow = Array.isArray(mainRule!.disallow)
      ? mainRule!.disallow
      : [mainRule!.disallow];
    expect(disallow).toContain("/dashboard");
    expect(disallow).toContain("/worlds/*");
    expect(disallow).toContain("/api/*");
    expect(disallow).toContain("/login");
    expect(disallow).toContain("/signup");
  });
});

// ─── sitemap.xml ────────────────────────────────────────────────────────────

describe("sitemap.xml", () => {
  it("includes correct absolute URLs for landing and demo pages", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const result = sitemap();

    const urls = result.map((entry) => entry.url);
    expect(urls).toContain("https://grimoire.pro");
    expect(urls).toContain("https://grimoire.pro/demo");
  });
});
