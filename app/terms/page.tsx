import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Grimoire",
  description:
    "Terms of Service for the Grimoire worldbuilding platform. Read our terms governing the use of our AI-powered creative writing tools.",
};

export default function TermsOfServicePage() {
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
              Terms of Service
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Last updated: June 15, 2025
            </p>
          </header>

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              1. Acceptance of Terms
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              By accessing or using the Grimoire platform (&quot;Service&quot;),
              you agree to be bound by these Terms of Service
              (&quot;Terms&quot;). If you do not agree to these Terms, you may
              not access or use the Service. These Terms apply to all visitors,
              users, and others who access or use the Service.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              2. Description of Service
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              Grimoire is an AI-powered worldbuilding studio that provides tools
              for creative writing, lore management, character development, and
              consistency checking. The Service includes web-based tools for
              inscribing lore, forging character souls, running consistency
              checks, and managing world bibles.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              3. User Accounts
            </h2>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                You must provide accurate and complete information when creating
                an account.
              </li>
              <li>
                You are responsible for maintaining the security of your account
                credentials.
              </li>
              <li>
                You must notify us immediately of any unauthorized use of your
                account.
              </li>
              <li>
                We reserve the right to suspend or terminate accounts that
                violate these Terms.
              </li>
            </ol>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              4. User Content and Intellectual Property
            </h2>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                You retain all ownership rights to the creative content you
                submit to the Service, including lore entries, character
                descriptions, and world data.
              </li>
              <li>
                By using the Service, you grant us a limited license to process,
                store, and display your content solely for the purpose of
                providing and improving the Service.
              </li>
              <li>
                AI-generated outputs (such as soul chat responses and
                consistency reports) are provided as creative aids. You may use
                these outputs freely in your own works.
              </li>
              <li>
                You represent that you have the right to submit any content you
                provide to the Service and that such content does not infringe
                upon any third-party rights.
              </li>
            </ol>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              5. Acceptable Use
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              You agree not to use the Service to:
            </p>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                Violate any applicable laws or regulations.
              </li>
              <li>
                Submit content that is harmful, threatening, abusive, or
                otherwise objectionable.
              </li>
              <li>
                Attempt to gain unauthorized access to the Service or its
                related systems.
              </li>
              <li>
                Interfere with or disrupt the integrity or performance of the
                Service.
              </li>
              <li>
                Use automated means to access the Service beyond the provided
                API limits.
              </li>
            </ol>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              6. Service Availability and Modifications
            </h2>
            <ol className="list-decimal space-y-3 pl-6 text-sm leading-7 text-[var(--text-muted)]">
              <li>
                We reserve the right to modify, suspend, or discontinue the
                Service at any time without prior notice.
              </li>
              <li>
                We may update these Terms from time to time. Continued use of
                the Service after changes constitutes acceptance of the updated
                Terms.
              </li>
              <li>
                We will make reasonable efforts to notify users of significant
                changes to these Terms.
              </li>
            </ol>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              7. Limitation of Liability
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              The Service is provided &quot;as is&quot; and &quot;as
              available&quot; without warranties of any kind, either express or
              implied. We do not warrant that the Service will be uninterrupted,
              secure, or error-free. In no event shall Grimoire be liable for
              any indirect, incidental, special, consequential, or punitive
              damages arising from your use of the Service.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              8. Termination
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              We may terminate or suspend your access to the Service immediately,
              without prior notice, for conduct that we believe violates these
              Terms or is harmful to other users, us, or third parties. Upon
              termination, your right to use the Service will immediately cease.
              You may export your data before termination upon request.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-4">
            <h2 className="font-heading text-2xl text-[var(--text-main)]">
              9. Contact
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              If you have any questions about these Terms, please contact us at{" "}
              <span className="text-[var(--accent)]">support@grimoire.pro</span>.
            </p>
          </section>

          {/* Footer nav */}
          <footer className="border-t border-[var(--border)] pt-8">
            <div className="flex gap-6 text-sm text-[var(--text-muted)]">
              <Link
                href="/privacy"
                className="text-[var(--accent)] hover:underline"
              >
                Privacy Policy
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
