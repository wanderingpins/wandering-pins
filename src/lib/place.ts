// Place labels come from MapTiler geocoding as e.g. "Denver, Colorado, United
// States". That's right for the journal and the map, but too long for the small
// starburst stickers on the cork cards, so they use this shorter form:
//   "Denver, Colorado, United States"        -> "Denver, CO"
//   "Paris, Île-de-France, France"           -> "Paris, France"
//   "Tokyo"                                  -> "Tokyo"

const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
  "puerto rico": "PR",
};

const US_NAMES = new Set(["united states", "united states of america", "usa", "us"]);

export function shortPlace(label: string): string {
  const parts = label
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return label.trim();

  const city = parts[0];
  const last = parts[parts.length - 1];

  if (US_NAMES.has(last.toLowerCase())) {
    // The state is usually the part just before the country, but look at every
    // middle part in case a county sits in between.
    for (const part of parts.slice(1, -1).reverse()) {
      const abbr = US_STATES[part.toLowerCase()];
      if (abbr) return `${city}, ${abbr}`;
    }
    return parts.length > 2 ? `${city}, ${parts[parts.length - 2]}` : city;
  }

  // A US state already abbreviated or written without the country.
  const abbr = US_STATES[last.toLowerCase()];
  if (abbr) return `${city}, ${abbr}`;

  return `${city}, ${last}`;
}
