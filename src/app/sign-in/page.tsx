import { SignInForm } from "./SignInForm";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignInPage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-4 py-24">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-600">
        No password — we&apos;ll email you a link to sign in.
      </p>
      <div className="mt-6">
        <SignInForm next={next} />
      </div>
    </main>
  );
}
