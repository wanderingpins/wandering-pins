import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works · Wandering Pins" };

// PLACEHOLDER copy — accurate to how the site works today, but the owner will
// want to rewrite it in their own voice (and maybe add pictures of a sticker).
const STEPS = [
  {
    title: "Get a passport for your pin",
    body: "Each Wandering Pins sticker has a QR code and a short code. Stick it on the back of a pin and scan it to register the pin to your account. (You can add a pin without a sticker too — it just can't travel until it has one.)",
  },
  {
    title: "Log where it's been",
    body: "Add where you got it, a photo and a description. Take it somewhere new? Log the new location — verify it with your phone's location if you like, and it earns a green star.",
  },
  {
    title: "Let it wander",
    body: "When you trade or give the pin away, log the trade. The next person scans the sticker and claims it, and the pin's journey continues on its public page.",
  },
  {
    title: "Follow the journey",
    body: "Anyone can scan a pin — no account needed — to see the map of everywhere it's been. Your notes and extra photos stay private to you.",
  },
  {
    title: "Track your sets",
    body: "Use Series to check off which pins you have in a set, see which ones you're still missing, and find other collectors to trade with.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Placeholder — final wording coming soon.</p>
      <h1 className="mt-6 text-3xl font-semibold">How it works</h1>

      <ol className="mt-6 flex flex-col gap-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-gold font-display font-bold text-navy">
              {i + 1}
            </span>
            <div>
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="mt-1 text-neutral-700">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/pins" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
          Browse pins
        </Link>
        <Link
          href="/about"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          About us
        </Link>
      </div>
    </main>
  );
}
