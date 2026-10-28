import { Starburst } from "@/components/PinSticker";

// The "Verified" star stuck next to a journey entry's place, same starburst as
// the status stickers on the pin cards. Only rendered for verified locations.
const VERIFIED_COLOR = "#7ED6B2";

export function VerifiedStar({ tilt = 8 }: { tilt?: number }) {
  return (
    <Starburst color={VERIFIED_COLOR} tilt={tilt} sizeClass="size-20" srText="Location verified">
      <span className="text-xl font-extrabold leading-none">✓</span>
      <span className="mt-0.5 text-[8px] font-bold tracking-[0.1em]">Verified</span>
    </Starburst>
  );
}
