export function PinJourneyTimeline({ lines }: { lines: string[] }) {
  return (
    <ol className="space-y-3">
      {lines.map((line, i) => {
        const isCurrent = i === lines.length - 1;
        return (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                isCurrent ? "bg-blue-600" : "bg-neutral-300"
              }`}
            />
            <span className={isCurrent ? "font-medium" : "text-neutral-700"}>{line}</span>
          </li>
        );
      })}
    </ol>
  );
}
