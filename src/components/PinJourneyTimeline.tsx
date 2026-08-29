import type { ReactNode } from "react";

// `badge` sits inline right after the line's text (e.g. the verified/not-
// verified indicator); `action` is a block-level slot below it (e.g. the
// inline "add details" widget, gated to the row's owner). Both generic
// ReactNode slots so this component stays presentational and doesn't need
// to know about ownership, holdings, or check-ins.
export type TimelineLine = { key: string; text: string; badge?: ReactNode; action?: ReactNode };

export function PinJourneyTimeline({ lines }: { lines: TimelineLine[] }) {
  return (
    <ol className="space-y-3">
      {lines.map((line, i) => {
        const isCurrent = i === lines.length - 1;
        return (
          <li key={line.key} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  isCurrent ? "bg-blue-600" : "bg-neutral-300"
                }`}
              />
              <span className={isCurrent ? "font-medium" : "text-neutral-700"}>{line.text}</span>
              {line.badge}
            </div>
            {line.action && <div className="pl-5">{line.action}</div>}
          </li>
        );
      })}
    </ol>
  );
}
