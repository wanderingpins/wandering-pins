// The privacy checkboxes under a "Where?" box: "Only show the state" on every
// place, and on a new pin also "Keep my part private" (PinHolding.isPrivate /
// regionOnly). Plain checkboxes, so they work inside any <form>; the server
// reads "on" for ticked and nothing for unticked.
export function PlacePrivacyChoices({
  defaultRegionOnly,
  withPrivate = false,
}: {
  /** Pre-ticked from Settings' "Always show my places as the state". */
  defaultRegionOnly: boolean;
  withPrivate?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Who sees this</legend>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="regionOnly" defaultChecked={defaultRegionOnly} className="mt-0.5 size-4" />
        <span>
          Only show the state
          <span className="block text-xs text-neutral-500">
            Others see &quot;California&quot; instead of the town. Good for a small town you live in.
          </span>
        </span>
      </label>
      {withPrivate && (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="isPrivate" className="mt-0.5 size-4" />
          <span>
            Keep my part of this pin&apos;s journey private
            <span className="block text-xs text-neutral-500">
              Others see &quot;a collector&quot; and &quot;somewhere private&quot; instead of your username and places,
              and the pin is left off Browse pins while you have it.
            </span>
          </span>
        </label>
      )}
    </fieldset>
  );
}
