import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Grimoire",
  description:
    "Privacy Policy for the Grimoire worldbuilding platform. Learn how we collect, use, and protect your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <article className="space-y-10">
          {/* Header */}
          <header className="space-y-4 border-b border-[var(--border)] pb-8">
            <Link
              href="/"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              ← Back to Grimoire
            </Link>
            <h1 className="font-heading text-4xl text-[var(--text-main)] md:text-5xl">
              Privacy Policy
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Last updated: June 15, 2025
            </p>
          </header>

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              1. Information We Collect
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              We collect information you provide directly when using the Grimoire
              platform:
            </p>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                <strong className="text-[var(--text-main)]">Account Information:</strong>{" "}
                Email address, display name, and authentication credentials when
                you create an account.
              </li>
              <li>
                <strong className="text-[var(--text-main)]">Content Data:</strong>{" "}
                Lore entries, character descriptions, world settings, and other
                creative content you submit to the Service.
              </li>
              <li>
                <strong className="text-[var(--text-main)]">Usage Data:</strong>{" "}
                Information about how you interact with the Service, including
                features used, pages visited, and actions taken.
              </li>
              <li>
                <strong className="text-[var(--text-main)]">Technical Data:</strong>{" "}
                Browser type, device information, IP address, and error logs
                collected automatically for service reliability.
              </li>
            </ol>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              2. How We Use Your Information
            </h2>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                To provide, maintain, and improve the Service and its features.
              </li>
              <li>
                To process your creative content through our AI systems for
                entity extraction, consistency checking, and character soul
                interactions.
              </li>
              <li>
                To communicate with you about your account, service updates, and
                support requests.
              </li>
              <li>
                To monitor and analyze usage patterns to improve user experience
                and performance.
              </li>
              <li>
                To detect, prevent, and address technical issues and security
                threats.
              </li>
            </ol>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              3. AI Processing and Your Content
            </h2>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                Your creative content is processed by AI models to provide
                features such as entity extraction, consistency checking, and
                soul chat responses.
              </li>
              <li>
                We do not use your creative content to train AI models. Your
                worlds, characters, and lore remain yours.
              </li>
              <li>
                AI-processed data (embeddings, extracted entities) is stored
                solely to provide Service functionality and is deleted when you
                delete the associated content.
              </li>
            </ol>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              4. Data Storage and Security
            </h2>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                Your data is stored securely using industry-standard encryption
                at rest and in transit.
              </li>
              <li>
                We use Supabase as our database provider, with data hosted in
                secure cloud infrastructure.
              </li>
              <li>
                We implement access controls, audit logging, and regular
                security reviews to protect your information.
              </li>
              <li>
                While we strive to protect your data, no method of electronic
                storage is 100% secure. We cannot guarantee absolute security.
              </li>
            </ol>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              5. Data Sharing
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              We do not sell your personal information. We may share data only in
              the following circumstances:
            </p>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                With service providers who assist in operating the platform
                (hosting, analytics, error monitoring) under strict
                confidentiality agreements.
              </li>
              <li>
                When required by law, regulation, or legal process.
              </li>
              <li>
                To protect the rights, property, or safety of Grimoire, our
                users, or the public.
              </li>
            </ol>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              6. Your Rights
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              You have the following rights regarding your personal data:
            </p>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                <strong className="text-[var(--text-main)]">Access:</strong>{" "}
                Request a copy of the personal data we hold about you.
              </li>
              <li>
                <strong className="text-[var(--text-main)]">Correction:</strong>{" "}
                Request correction of inaccurate or incomplete personal data.
              </li>
              <li>
                <strong className="text-[var(--text-main)]">Deletion:</strong>{" "}
                Request deletion of your account and associated data.
              </li>
              <li>
                <strong className="text-[var(--text-main)]">Export:</strong>{" "}
                Request an export of your creative content in a portable format.
              </li>
            </ol>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              7. Cookies and Tracking
            </h2>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                We use essential cookies for authentication and session
                management.
              </li>
              <li>
                Our analytics service operates in cookieless mode and does not
                set tracking cookies on your device.
              </li>
              <li>
                We do not use third-party advertising cookies or cross-site
                tracking technologies.
              </li>
            </ol>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              8. Data Retention
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              We retain your account information and creative content for as long
              as your account is active. If you delete your account, we will
              remove your personal data and creative content within 30 days,
              except where retention is required by law. Anonymized usage data
              may be retained for analytical purposes.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              9. Changes to This Policy
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              We may update this Privacy Policy from time to time. We will notify
              you of significant changes by posting the new policy on this page
              and updating the &quot;Last updated&quot; date. Continued use of
              the Service after changes constitutes acceptance of the updated
              policy.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              10. Contact
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              If you have questions about this Privacy Policy or wish to exercise
              your data rights, please contact us at{" "}
              <span className="text-[var(--accent)]">privacy@grimoire.pro</span>.
            </p>
          </section>

          {/* Footer nav */}
          <footer className="border-t border-[var(--border)] pt-8">
            <div className="flex gap-6 text-sm text-[var(--text-muted)]">
              <Link
                href="/terms"
                className="text-[var(--accent)] hover:underline"
              >
                Terms of Service
              </Link>
              <Link href="/" className="text-[var(--accent)] hover:underline">
                Home
              </Link>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
