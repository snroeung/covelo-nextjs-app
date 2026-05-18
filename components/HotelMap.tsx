'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface HotelPin {
  id: string;
  accommodationId: string;
  name: string;
  photo: string | null;
  lat: number;
  lng: number;
}

// SVG pin path — teardrop shape pointing downward
const PIN_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
      fill="#2563eb" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>
`.trim();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HotelMap({ accommodations, center, onLearnMore }: { accommodations: any[]; center: { lat: number; lng: number }; onLearnMore?: (accommodationId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popup, setPopup] = useState<{ hotel: HotelPin; x: number; y: number } | null>(null);
  const { isDark } = useTheme();

  function scheduleHide() {
    hideTimerRef.current = setTimeout(() => setPopup(null), 180);
  }

  function cancelHide() {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;

      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY!;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: isDark
          ? 'mapbox://styles/mapbox/dark-v11'
          : 'mapbox://styles/mapbox/light-v11',
        center: [center.lng, center.lat],
        zoom: 12,
      });

      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

      map.on('load', () => {
        if (cancelled) return;

        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        const hotels: HotelPin[] = accommodations
          .filter((sr) => sr.accommodation?.location?.geographic_coordinates)
          .map((sr) => ({
            id: sr.id,
            accommodationId: sr.accommodation.id,
            name: sr.accommodation.name ?? 'Hotel',
            photo: sr.accommodation.photos?.[0]?.url ?? null,
            lat: sr.accommodation.location.geographic_coordinates.latitude,
            lng: sr.accommodation.location.geographic_coordinates.longitude,
          }));

        hotels.forEach((hotel) => {
          // Outer wrapper: Mapbox controls the transform on this element — never touch it
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'cursor: pointer; width: 28px; height: 36px;';

          // Inner pin: safe to scale without breaking Mapbox positioning
          const pin = document.createElement('div');
          pin.style.cssText = 'width: 28px; height: 36px; transition: transform 0.15s; transform-origin: bottom center;';
          pin.innerHTML = PIN_SVG;
          wrapper.appendChild(pin);

          wrapper.addEventListener('mouseenter', () => {
            cancelHide();
            pin.style.transform = 'scale(1.25)';
            const point = map.project([hotel.lng, hotel.lat]);
            setPopup({ hotel, x: point.x, y: point.y });
          });

          wrapper.addEventListener('mouseleave', () => {
            pin.style.transform = 'scale(1)';
            scheduleHide();
          });

          wrapper.addEventListener('click', () => {
            onLearnMore?.(hotel.accommodationId);
            const container = document.getElementById('app-main-scroll');
            const target = document.getElementById(`hotel-${hotel.accommodationId}`);
            if (container && target) {
              const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
              container.scrollTo({ top: offset, behavior: 'smooth' });
            }
          });

          // anchor: 'bottom' so the pin tip sits on the coordinate
          const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'bottom' })
            .setLngLat([hotel.lng, hotel.lat])
            .addTo(map);

          markersRef.current.push(marker);
        });
      });
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accommodations, center.lat, center.lng, isDark]);

  const cardBg = isDark ? 'bg-cv-blue-900 border-cv-blue-700' : 'bg-white border-cv-blue-100';
  const textPrimary = isDark ? 'text-white' : 'text-cv-blue-950';

  return (
    <div className="hidden md:block relative w-full rounded-xl overflow-hidden" style={{ height: '300px' }}>
      <div ref={containerRef} className="w-full h-full" />

      {popup && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: Math.min(popup.x + 12, (containerRef.current?.clientWidth ?? 600) - 192),
            top: Math.max(popup.y - 176, 8),
          }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <div className={`pointer-events-auto w-44 rounded-xl border shadow-xl overflow-hidden ${cardBg}`}>
            {popup.hotel.photo ? (
              <img
                src={popup.hotel.photo}
                alt={popup.hotel.name}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className={`w-full h-24 ${isDark ? 'bg-cv-blue-800' : 'bg-cv-blue-50'}`} />
            )}
            <div className="p-2.5">
              <p className={`text-xs font-semibold line-clamp-2 leading-snug ${textPrimary}`}>
                {popup.hotel.name}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
