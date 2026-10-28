import type { ReactNode } from "react";
import { EndSticker, JournalSticker } from "@/components/JournalSticker";
import { JourneyTrail } from "@/components/JourneyTrail";
import { PushPin } from "@/components/PushPin";
import { journalEntryStyle } from "@/lib/pin-card-style";

// One journal entry per journey step. `date`/`kicker`/`place`/`holder` are the
// public, structured-only facts (brief section 7); `star` is the verified
// sticker beside the place; `badge` sits next to the signature (the owner's
// "Verify location" link); `action` is a block-level slot inside the page (the
// owner's private notes and photos, gated by the caller). Generic ReactNode
// slots keep this presentational — it knows nothing about ownership.
export type TimelineLine = {
  key: string;
  date: string;
  kicker: string;
  place: string;
  holder: string;
  star?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
};

// The trail (JourneyTrail) starts at the bottom of the map and runs down
// through a push pin on every sticker. The gutter is 44px wide (pl-11) and each
// pin sits at x=36 (left-7 + half its 16px), 92px below the top of its entry —
// right where the sticker's left edge lands. The empty `data-trail-pin` anchors
// mark those centers for the trail to measure.
export function PinJourneyTimeline({ lines, end }: { lines: TimelineLine[]; end?: ReactNode }) {
  const endStyle = journalEntryStyle("journey-end");
  return (
    <JourneyTrail>
      <ol className="pt-12">
        {lines.map((line) => {
          const style = journalEntryStyle(line.key);
          return (
            <li key={line.key} className="relative pb-10 pl-11">
              <span
                aria-hidden="true"
                data-trail-pin
                data-variant={style.trailVariant}
                className="absolute left-9 top-[92px] size-0"
              />
              <PushPin color={style.pinColor} className="left-7 top-[84px] z-20" />

              {/* The journal page. Tilts barely (a degree), unlike the sticker on it. */}
              <div
                className="relative rounded-[3px] bg-paper px-5 pb-4 pt-5 text-ink shadow-[0_6px_10px_rgba(0,0,0,0.4)]"
                style={{ transform: `rotate(${style.pageTilt}deg)` }}
              >
                <span aria-hidden="true" className="absolute -top-2 right-6 h-5 w-14 rotate-3 bg-gold/70" />

                <p className="font-hand text-3xl font-bold leading-9">{line.date}</p>
                {/* Pulled left over the page edge so the pin lands on its corner. */}
                <div className="-ml-7 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <JournalSticker
                    kicker={line.kicker}
                    place={line.place}
                    color={style.stickerColor}
                    tilt={style.stickerTilt}
                  />
                  {line.star}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-hand text-xl text-ink/70">— {line.holder}</span>
                  {line.badge}
                </div>
                {line.action && <div className="mt-3">{line.action}</div>}
              </div>
            </li>
          );
        })}

        {/* The last stop: its own pin and sticker, with what to do next beside it. */}
        <li className="relative pb-2 pl-11">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="relative -ml-7 w-fit">
              <span
                aria-hidden="true"
                data-trail-pin
                data-variant={endStyle.trailVariant}
                className="absolute left-5 top-1/2 size-0"
              />
              <PushPin color={endStyle.pinColor} className="left-3 top-1/2 z-20 -mt-2" />
              <EndSticker />
            </div>
            {end && <div className="min-w-0">{end}</div>}
          </div>
        </li>
      </ol>
    </JourneyTrail>
  );
}
