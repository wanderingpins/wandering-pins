import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About · Wandering Pins" };

// PLACEHOLDER copy — the structure is here so the page can be linked from the
// footer; the words still need the owner's own story.
export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Placeholder — final wording coming soon.</p>
      <h1 className="mt-6 text-3xl font-semibold">About Wandering Pins</h1>

      <p className="mt-4 text-neutral-700">
        Pin collectors trade constantly, and every pin picks up a story along the way. Wandering Pins gives each pin a
        passport — a small sticker on the back — so anyone who scans it can see where it&apos;s been and who&apos;s
        carried it.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Why we built it</h2>
      <p className="mt-2 text-neutral-700">[Your story: how the idea started, who&apos;s behind it, where you&apos;re based.]</p>

      <h2 className="mt-8 text-xl font-semibold">What it isn&apos;t</h2>
      <p className="mt-2 text-neutral-700">
        Wandering Pins doesn&apos;t prove a pin is genuine. Journeys are reported by the people who hold each pin —
        it&apos;s a shared travel diary, not a certificate of authenticity.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Get in touch</h2>
      <p className="mt-2 text-neutral-700">[Contact email or form.]</p>

      <p className="mt-10">
        <Link href="/how-it-works" className="text-accent hover:underline">
          How it works &rarr;
        </Link>
      </p>
    </main>
  );
}
