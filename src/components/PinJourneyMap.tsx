"use client";

import { useEffect, useRef } from "react";
import { Map, Marker, Popup, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ensureMapWorkerConfigured, getMapStyleUrl } from "@/lib/map-config";

export type JourneyPoint = {
  lat: number;
  lng: number;
  label: string;
};

export function PinJourneyMap({ points }: { points: JourneyPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;

    ensureMapWorkerConfigured();
    const map = new Map({
      container: containerRef.current,
      style: getMapStyleUrl(),
      center: [points[0].lng, points[0].lat],
      zoom: 3,
    });
    mapRef.current = map;

    map.on("load", () => {
      for (const point of points) {
        new Marker().setLngLat([point.lng, point.lat]).setPopup(
          new Popup({ offset: 24 }).setText(point.label)
        ).addTo(map);
      }

      if (points.length > 1) {
        map.addSource("journey-line", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: points.map((p) => [p.lng, p.lat]),
            },
          },
        });
        map.addLayer({
          id: "journey-line",
          type: "line",
          source: "journey-line",
          paint: { "line-color": "#2563eb", "line-width": 2, "line-dasharray": [2, 2] },
        });
      }

      const bounds = points.reduce(
        (b, p) => b.extend([p.lng, p.lat]),
        new LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat])
      );
      map.fitBounds(bounds, { padding: 48, maxZoom: 10 });
    });

    return () => map.remove();
  }, [points]);

  return <div ref={containerRef} className="h-96 w-full rounded-lg" />;
}
