import { CorkBoard } from "@/components/CorkBoard";
import { Logo } from "@/components/Logo";
import { PinLookupForm } from "@/components/PinLookupForm";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <CorkBoard className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="sr-only">Wandering Pins</h1>
        <Logo surface="cork" className="w-full max-h-[40vh] max-w-[560px]" />
        <p className="mt-6 max-w-md text-lg font-medium text-cork-ink">
          Every pin has a journey. Scan the code on the back, or type it below, to see where it&apos;s
          been.
        </p>
        <div className="mt-8 w-full max-w-sm rounded-xl bg-navy/95 p-3 text-left sm:p-4 shadow-xl ring-2 ring-gold/70">
          <PinLookupForm />
        </div>
      </CorkBoard>
    </main>
  );
}
