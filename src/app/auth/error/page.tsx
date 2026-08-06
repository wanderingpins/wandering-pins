import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">That link didn&apos;t work</h1>
      <p className="mt-3 text-neutral-700">
        It may have expired or already been used. Request a new one below.
      </p>
      <Link
        href="/sign-in"
        className="mt-6 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Back to sign in
      </Link>
    </main>
  );
}
