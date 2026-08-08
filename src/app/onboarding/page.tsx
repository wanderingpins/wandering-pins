import { redirect } from "next/navigation";
import { getOrCreateAppUser, safeNext } from "@/lib/auth";
import { OnboardingForm } from "./OnboardingForm";

type Props = { searchParams: Promise<{ next?: string }> };

// Reached only via requireAppUser's redirect (src/lib/auth.ts) for anyone
// with no username yet. Uses getOrCreateAppUser directly rather than
// requireAppUser — the latter would redirect right back here, looping.
export default async function OnboardingPage({ searchParams }: Props) {
  const { next } = await searchParams;

  const user = await getOrCreateAppUser();
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(next ?? "/onboarding")}`);
  }
  if (user.username) {
    redirect(safeNext(next));
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-semibold">Set up your account</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Pick a username — this is what other collectors will see instead of your email. Set a
        password too, so you&apos;re never locked out even if you lose access to this email address
        later.
      </p>
      <div className="mt-6">
        <OnboardingForm next={next} />
      </div>
    </main>
  );
}
