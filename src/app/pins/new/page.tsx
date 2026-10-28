import { requireAppUser } from "@/lib/auth";
import { PinRegistrationForm } from "@/components/PinRegistrationForm";
import { createPinWithoutSticker } from "./actions";

export default async function NewPinPage() {
  await requireAppUser("/pins/new");

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-xl font-semibold">Add a pin</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Add a pin you own, even without a Wandering Pins sticker. It gets its own page, but it can&apos;t be traded,
        claimed by anyone else, or log new places until a sticker is attached to it.
      </p>
      <div className="mt-6">
        <PinRegistrationForm action={createPinWithoutSticker} submitLabel="Add this pin" pendingLabel="Adding…" />
      </div>
    </main>
  );
}
