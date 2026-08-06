import { PinLookupForm } from "@/components/PinLookupForm";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Wandering Pins</h1>
      <p className="mt-4 max-w-md text-lg text-neutral-600">
        Every pin has a journey. Scan the code on the back, or type it below, to see where it&apos;s
        been.
      </p>
      <div className="mt-8 w-full max-w-sm">
        <PinLookupForm />
      </div>
    </main>
  );
}
