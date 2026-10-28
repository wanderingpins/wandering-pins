import { notFound } from "next/navigation";
import { PinView } from "@/components/PinView";
import { parsePinNumber } from "@/lib/pin-number";

type Props = { params: Promise<{ number: string }> };

// The public, shareable pin page. Keyed by Pin.number, which is not a
// credential — the sticker's code never appears in this URL or page.
export default async function PinPage({ params }: Props) {
  const { number: rawNumber } = await params;
  const pinNumber = parsePinNumber(rawNumber);
  if (pinNumber === null) notFound();
  return <PinView pinNumber={pinNumber} />;
}
