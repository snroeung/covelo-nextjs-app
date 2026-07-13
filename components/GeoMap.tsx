'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc-client';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_KEY ?? '';

export interface GeoPin {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  draggable?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

interface GeocodingFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface InternalPin { id: string; label: string; lng: number; lat: number; markerEl: HTMLDivElement; marker: any }

interface GeoMapProps {
  isDark: boolean;
  markerVariant: 'teardrop' | 'dot';
  zoomControls?: 'navigation' | 'hover-buttons' | 'none';
  allowFullscreen?: boolean;
  onPinClick?: (pin: GeoPin) => void;
  onBackgroundClick?: () => void;

  // Fixed-pin dock-card mode (Hotel)
  pins?: GeoPin[];
  center?: { lat: number; lng: number };
  renderPinCard?: (pin: GeoPin) => { expanded: ReactNode; tuck: ReactNode };

  // Interactive pin-CRUD mode (Trip)
  lat?: number;
  lng?: number;
  destinationLabel?: string;
  borderCls?: string;
  enableSearch?: boolean;
  enablePoiPopup?: boolean;
  showPinTabs?: boolean;
  draggableMarkers?: boolean;
  initialPins?: GeoPin[];
  onPinsChange?: (pins: GeoPin[]) => void;
  header?: false | { title: string };
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

// POI label layers present in both streets-v12 and dark-v11
const CLICKABLE_POI_LAYERS = ['poi-label', 'airport-label', 'transit-label'];

// ─── Marker visual styles ───────────────────────────────────────────────────

const PIN_SVG = `
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
      fill="#2563eb" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>
`.trim();

const PIN_SVG_ACTIVE = `
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
      fill="#22C55E" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>
`.trim();

const ACTIVE_PIN_CSS = [
  'width:26px', 'height:26px', 'border-radius:50%',
  'background:#6366f1', 'border:2.5px solid #fff',
  'box-shadow:0 2px 8px rgba(0,0,0,0.35)', 'cursor:grab', 'transition:all .15s',
].join(';');

const IDLE_PIN_CSS = [
  'width:20px', 'height:20px', 'border-radius:50%',
  'background:#64748b', 'border:2px solid #fff',
  'box-shadow:0 1px 4px rgba(0,0,0,0.2)', 'cursor:grab', 'transition:all .15s',
].join(';');

const ChevronUp = (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 15l7-7 7 7" />
  </svg>
);

export function GeoMap({
  isDark, markerVariant, zoomControls = 'none', allowFullscreen = false, onPinClick, onBackgroundClick,
  pins, center, renderPinCard,
  lat, lng, destinationLabel, borderCls = '', enableSearch, enablePoiPopup,
  showPinTabs, draggableMarkers, initialPins, onPinsChange,
  header, minimized = false, onToggleMinimize,
}: GeoMapProps) {
  const dockMode = pins !== undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isFullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsFullscreen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 60);
    return () => clearTimeout(t);
  }, [isFullscreen]);

  // ── Dock-card mode state (Hotel) ────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const pinElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [openPin, setOpenPin] = useState<GeoPin | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const openPinIdRef = useRef<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const dragStartYRef = useRef(0);

  useEffect(() => {
    openPinIdRef.current = openPin?.id ?? null;
  }, [openPin]);

  useEffect(() => {
    setIsMinimized(false);
  }, [openPin?.id]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current || !cardRef.current) return;
      const dy = Math.max(0, e.clientY - dragStartYRef.current);
      cardRef.current.style.transform = `translateY(${dy}px)`;
    }
    function onPointerUp(e: PointerEvent) {
      if (!draggingRef.current || !cardRef.current) return;
      draggingRef.current = false;
      const dy = Math.max(0, e.clientY - dragStartYRef.current);
      cardRef.current.style.transform = '';
      if (dy > 60) setIsMinimized(true);
    }
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  function onGrabPointerDown(e: React.PointerEvent) {
    draggingRef.current = true;
    dragStartYRef.current = e.clientY;
  }

  useEffect(() => {
    if (!dockMode) return;
    pinElsRef.current.forEach((el, id) => {
      const active = id === openPin?.id;
      el.innerHTML = active ? PIN_SVG_ACTIVE : PIN_SVG;
      el.style.transform = active ? 'scale(1.15)' : 'scale(1)';
    });
  }, [dockMode, openPin]);

  useEffect(() => {
    if (!openPin) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenPin(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dockMode, openPin]);

  const centerLat = center?.lat ?? lat;
  const centerLng = center?.lng ?? lng;

  // ── Dock-card mode: declarative fixed-pin init ──────────────────────────
  useEffect(() => {
    if (!dockMode) return;
    if (!containerRef.current || centerLat == null || centerLng == null) return;

    let cancelled = false;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
        center: [centerLng, centerLat],
        zoom: 12,
      });

      mapRef.current = map;

      if (zoomControls === 'navigation') {
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      }

      map.on('click', () => {
        setOpenPin(null);
        onBackgroundClick?.();
      });

      map.on('load', () => {
        if (cancelled) return;

        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        pinElsRef.current.clear();

        (pins ?? []).forEach((pin) => {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'cursor: pointer; width: 44px; height: 52px; display: flex; align-items: flex-end; justify-content: center;';
          wrapper.setAttribute('tabindex', '0');
          wrapper.setAttribute('role', 'button');
          wrapper.setAttribute('aria-label', `View ${pin.label ?? 'location'}`);

          const pinEl = document.createElement('div');
          pinEl.style.cssText = 'width: 28px; height: 36px; transition: transform 0.15s; transform-origin: bottom center;';
          pinEl.innerHTML = pin.id === openPinIdRef.current ? PIN_SVG_ACTIVE : PIN_SVG;
          if (pin.id === openPinIdRef.current) pinEl.style.transform = 'scale(1.15)';
          wrapper.appendChild(pinEl);
          pinElsRef.current.set(pin.id, pinEl);

          function openThisPin() {
            setOpenPin((prev) => (prev?.id === pin.id ? null : pin));
            onPinClick?.(pin);
          }

          wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            openThisPin();
          });

          wrapper.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              openThisPin();
            }
          });

          const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'bottom' })
            .setLngLat([pin.lng, pin.lat])
            .addTo(map);

          markersRef.current.push(marker);
        });
      });
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      pinElsRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
      setOpenPin(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockMode, pins, centerLat, centerLng, isDark, zoomControls]);

  // ── Interactive mode state (Trip) ───────────────────────────────────────
  const geocodeDebRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);

  const pinsRef = useRef<InternalPin[]>([]);
  const activePinIdRef = useRef<string | null>(null);
  const onPinsChangeRef = useRef(onPinsChange);
  const initialPinsRef = useRef(initialPins);

  onPinsChangeRef.current = onPinsChange;
  initialPinsRef.current = initialPins;

  const [interactivePins, setInteractivePins] = useState<InternalPin[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingFeature[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapHovered, setMapHovered] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const hasCoords = !dockMode && lat != null && lng != null && (lat !== 0 || lng !== 0);

  const placeInfoCacheRef = useRef<Record<string, { address: string; photoUrl: string | null }>>({});

  const fetchPlaceInfo = useCallback((geoPin: GeoPin) => {
    const cached = placeInfoCacheRef.current[geoPin.id];
    if (cached) {
      setOpenPin((prev) => (prev && prev.id === geoPin.id ? { ...prev, data: { ...cached } } : prev));
      return;
    }
    const label = geoPin.label ?? '';
    Promise.all([
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${geoPin.lng},${geoPin.lat}.json` +
        `?access_token=${MAPBOX_TOKEN}&types=address,poi,neighborhood,locality,place&limit=1`,
      )
        .then((r) => r.json() as Promise<{ features: { place_name: string }[] }>)
        .then((data) => {
          const raw = data.features?.[0]?.place_name ?? '';
          return raw.startsWith(label) ? raw.slice(label.length).replace(/^,\s*/, '') : raw;
        })
        .catch(() => ''),
      trpc.places.getPhoto.query({ name: label, address: '' }).catch(() => null),
    ]).then(([address, photoUrl]) => {
      placeInfoCacheRef.current[geoPin.id] = { address, photoUrl };
      setOpenPin((prev) => (prev && prev.id === geoPin.id ? { ...prev, data: { address, photoUrl } } : prev));
    });
  }, []);

  const activatePin = useCallback((pinId: string) => {
    const map = mapRef.current;
    if (!map) return;
    const pin = pinsRef.current.find((p) => p.id === pinId);
    if (!pin) return;

    for (const p of pinsRef.current) {
      p.markerEl.style.cssText = p.id === pinId ? ACTIVE_PIN_CSS : IDLE_PIN_CSS;
    }
    activePinIdRef.current = pinId;
    setActivePinId(pinId);
    map.flyTo({ center: [pin.lng, pin.lat], duration: 500 });
    const found = pinsRef.current.find((p) => p.id === pinId);
    if (found) {
      const geoPin: GeoPin = { id: found.id, label: found.label, lat: found.lat, lng: found.lng };
      onPinClick?.(geoPin);
      if (renderPinCard) {
        const wasOpen = openPinIdRef.current === geoPin.id;
        setOpenPin((prev) => (prev?.id === geoPin.id ? null : geoPin));
        if (!wasOpen) fetchPlaceInfo(geoPin);
      }
    }
  }, [onPinClick, renderPinCard, fetchPlaceInfo]);

  function persistPins() {
    onPinsChangeRef.current?.(
      pinsRef.current.map(({ id, label, lng: pLng, lat: pLat }) => ({ id, label, lng: pLng, lat: pLat })),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function spawnPin(map: any, mapboxgl: any, pLng: number, pLat: number, label: string, pinId?: string, openCard = false): InternalPin {
    for (const p of pinsRef.current) p.markerEl.style.cssText = IDLE_PIN_CSS;

    const el = document.createElement('div');
    el.style.cssText = ACTIVE_PIN_CSS;

    const marker = new mapboxgl.Marker({ element: el, draggable: draggableMarkers ?? true })
      .setLngLat([pLng, pLat])
      .addTo(map);

    const id = pinId ?? (pinsRef.current.length === 0 ? 'default' : crypto.randomUUID());
    const pin: InternalPin = { id, label, lng: pLng, lat: pLat, markerEl: el, marker };

    el.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      activatePin(pin.id);
    });

    marker.on('dragend', () => {
      const { lng: newLng, lat: newLat } = marker.getLngLat();
      const found = pinsRef.current.find((p) => p.id === pin.id);
      if (found) { found.lng = newLng; found.lat = newLat; }
      setInteractivePins([...pinsRef.current]);
      persistPins();
    });

    pinsRef.current = [...pinsRef.current, pin];
    activePinIdRef.current = id;
    setInteractivePins([...pinsRef.current]);
    setActivePinId(id);
    if (renderPinCard && openCard) {
      const geoPin: GeoPin = { id, label, lat: pLat, lng: pLng };
      setOpenPin(geoPin);
      fetchPlaceInfo(geoPin);
    }
    if (!isRestoringRef.current) persistPins();

    return pin;
  }

  function removePin(pinId: string) {
    const pin = pinsRef.current.find((p) => p.id === pinId);
    if (!pin) return;
    pin.marker.remove();
    pinsRef.current = pinsRef.current.filter((p) => p.id !== pinId);
    setInteractivePins([...pinsRef.current]);
    persistPins();
    if (activePinIdRef.current === pinId) {
      if (pinsRef.current.length > 0) {
        activatePin(pinsRef.current[pinsRef.current.length - 1].id);
      } else {
        activePinIdRef.current = null;
        setActivePinId(null);
        setOpenPin(null);
      }
    }
  }

  async function runGeocode(query: string) {
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
        `?access_token=${MAPBOX_TOKEN}&autocomplete=true&types=place,address,poi&limit=5`,
      );
      const data = await res.json() as { features: GeocodingFeature[] };
      setSearchResults(data.features ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleSearchSelect(feature: GeocodingFeature) {
    const map = mapRef.current;
    if (!map) return;
    const [fLng, fLat] = feature.center;
    const label = feature.place_name.split(',')[0].trim();
    map.flyTo({ center: [fLng, fLat], zoom: 14, duration: 600 });
    import('mapbox-gl').then(({ default: mapboxgl }) => spawnPin(map, mapboxgl, fLng, fLat, label, undefined, true));
    setSearchQuery('');
    setSearchResults([]);
  }

  useEffect(() => {
    if (dockMode) return;
    if (!containerRef.current || !hasCoords) return;

    let cancelled = false;
    const initLng = lng!;
    const initLat = lat!;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12',
        center: [initLng, initLat],
        zoom: 14,
        attributionControl: false,
      });

      map.once('load', () => {
        if (cancelled) return;
        const saved = initialPinsRef.current;
        if (saved && saved.length > 0) {
          isRestoringRef.current = true;
          for (const p of saved) spawnPin(map, mapboxgl, p.lng, p.lat, p.label ?? '', p.id);
          isRestoringRef.current = false;
        } else {
          spawnPin(map, mapboxgl, initLng, initLat, (destinationLabel ?? '').split(',')[0], 'default');
        }

        if (enablePoiPopup) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.on('click', (e: any) => {
            const features = map.queryRenderedFeatures(e.point, { layers: CLICKABLE_POI_LAYERS });
            if (features.length === 0) {
              setOpenPin(null);
              onBackgroundClick?.();
              return;
            }
            const feature = features[0];
            const props = feature.properties ?? {};
            const name = ((props.name_en ?? props.name) as string | undefined)?.trim() ?? '';
            if (!name) return;
            const geom = feature.geometry as { type: 'Point'; coordinates: [number, number] };
            const [poiLng, poiLat] = geom.coordinates;
            if (renderPinCard) {
              const geoPin: GeoPin = { id: `poi:${poiLng},${poiLat}`, label: name, lat: poiLat, lng: poiLng };
              onPinClick?.(geoPin);
              setOpenPin(geoPin);
              fetchPlaceInfo(geoPin);
            }
          });

          for (const layer of CLICKABLE_POI_LAYERS) {
            map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
          }
        } else {
          map.on('click', () => { setOpenPin(null); onBackgroundClick?.(); });
        }
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      pinsRef.current = [];
      activePinIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockMode, hasCoords]);

  useEffect(() => {
    if (dockMode) return;
    if (minimized) return;
    const t = setTimeout(() => mapRef.current?.resize(), 310);
    return () => clearTimeout(t);
  }, [dockMode, minimized]);

  useEffect(() => {
    if (dockMode) return;
    mapRef.current?.setStyle(isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12');
  }, [dockMode, isDark]);

  useEffect(() => {
    if (dockMode || !enableSearch) return;
    if (geocodeDebRef.current) clearTimeout(geocodeDebRef.current);
    geocodeDebRef.current = setTimeout(() => runGeocode(searchQuery), 300);
    return () => { if (geocodeDebRef.current) clearTimeout(geocodeDebRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockMode, enableSearch, searchQuery]);

  useEffect(() => {
    if (dockMode || !enableSearch) return;
    function onDown(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dockMode, enableSearch]);

  function zoomIn()  { mapRef.current?.zoomIn(); }
  function zoomOut() { mapRef.current?.zoomOut(); }

  // ── Dock-card chrome styles ──────────────────────────────────────────────
  const cardBg = isDark ? 'bg-gph-dark-card border-gph-dark-line' : 'bg-white border-gray-200';
  const closeBtnCls = isDark
    ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-gph-dark-line'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  const grabBarCls = isDark ? 'bg-gph-dark-line' : 'bg-gray-300';

  // ── Interactive-mode chrome styles ───────────────────────────────────────
  const bg        = isDark ? 'bg-gph-dark-bg'    : 'bg-white';
  const mutedText = isDark ? 'text-gph-dark-muted' : 'text-gray-500';
  const btnCls    = isDark
    ? 'bg-gph-dark-card/80 border border-gph-dark-line text-gph-dark-ink hover:bg-gph-dark-linesoft hover:text-gph-dark-ink'
    : 'bg-white/80 border border-gray-200 text-gray-600 hover:bg-gray-50';
  const pillBase  = 'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 whitespace-nowrap';
  const pillIdle  = isDark
    ? 'bg-gph-dark-linesoft text-gph-dark-ink hover:bg-gph-dark-line'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  const pillOn    = isDark ? 'bg-gph-dark-action text-gph-dark-bg' : 'bg-gray-900 text-white';

  const fullscreenBtn = allowFullscreen && (
    <button
      type="button"
      onClick={() => setIsFullscreen((v) => !v)}
      aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
      title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
      className={`absolute top-3 right-3 z-30 min-h-11 min-w-11 rounded-lg flex items-center justify-center backdrop-blur-sm transition-colors ${btnCls}`}
    >
      {isFullscreen ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
      )}
    </button>
  );

  const openPinCard = openPin && renderPinCard ? renderPinCard(openPin) : null;

  const cardOverlay = (
    <div
      className={`absolute left-4 bottom-4 z-20 w-75 max-w-[calc(100%-2rem)] transition-all duration-200 ease-out ${
        openPin ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0 pointer-events-none'
      }`}
    >
      {openPin && openPinCard && (
        <div ref={cardRef} data-testid="map-pin-card" className={`rounded-2xl border shadow-xl overflow-hidden ${cardBg}`}>
          {isMinimized ? (
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="w-full flex items-center gap-2.5 p-2.5 text-left"
            >
              {openPinCard.tuck}
              <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${closeBtnCls}`}>
                {ChevronUp}
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onPointerDown={onGrabPointerDown}
                onClick={() => setIsMinimized(true)}
                aria-label="Minimize card"
                className="w-full flex justify-center items-center py-2.5 cursor-grab touch-none"
              >
                <div className={`w-9 h-1 rounded-full ${grabBarCls}`} />
              </button>
              {openPinCard.expanded}
            </>
          )}
        </div>
      )}
    </div>
  );

  if (dockMode) {
    return (
      <div
        data-testid="hotel-map"
        className={isFullscreen ? `fixed inset-0 z-50 ${bg}` : 'relative w-full h-full rounded-xl overflow-hidden'}
      >
        <div ref={containerRef} className="w-full h-full" />
        {fullscreenBtn}
        {cardOverlay}
      </div>
    );
  }

  const showHeader = !!header;

  return (
    <div className={`flex flex-col overflow-hidden ${bg} ${isFullscreen ? 'fixed inset-0 z-50' : `h-full border-l ${borderCls}`}`}>

      {showHeader && header && (
        <div className={`shrink-0 flex items-center justify-between px-3 py-2.5 border-b ${borderCls}`}>
          <div className="flex items-center gap-1.5 min-w-0 mr-2">
            <svg className={`w-3.5 h-3.5 shrink-0 ${mutedText}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
            </svg>
            <span className={`text-xs font-semibold truncate ${isDark ? 'text-gph-dark-ink' : 'text-gray-800'}`}>
              {header.title}
            </span>
          </div>
          <button
            onClick={onToggleMinimize}
            title={minimized ? 'Expand map' : 'Minimize map'}
            className={`shrink-0 p-1 rounded transition-colors ${mutedText}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {minimized
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              }
            </svg>
          </button>
        </div>
      )}

      {enableSearch && (
        <div
          ref={searchBoxRef}
          className={`shrink-0 border-b ${borderCls} transition-all duration-300 ${minimized ? 'h-0 overflow-hidden border-b-0' : 'relative'}`}
        >
          <div className={`flex items-center gap-2 px-3 ${isDark ? 'bg-gph-dark-bg' : 'bg-white'}`}>
            {searchLoading ? (
              <svg className={`w-4 h-4 shrink-0 animate-spin ${mutedText}`} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className={`w-4 h-4 shrink-0 ${mutedText}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); setSearchResults([]); } }}
              placeholder="Search location to add pin…"
              disabled={!hasCoords}
              className={`flex-1 py-2.5 text-sm bg-transparent outline-none disabled:opacity-40 ${isDark
                ? 'text-gph-dark-ink placeholder:text-gph-dark-muted'
                : 'text-gray-900 placeholder:text-gray-400'}`}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                className={`shrink-0 p-1 rounded transition-colors ${mutedText}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {searchResults.length > 0 && (
            <ul className={`absolute inset-x-0 top-full z-20 border-t shadow-xl ${isDark
              ? 'bg-gph-dark-card border-gph-dark-line'
              : 'bg-white border-gray-200'}`}>
              {searchResults.map((s) => {
                const [head, ...rest] = s.place_name.split(',');
                return (
                  <li key={s.id}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSearchSelect(s)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${isDark
                        ? 'text-gph-dark-ink hover:bg-gph-dark-linesoft'
                        : 'text-gray-900 hover:bg-gray-50'}`}
                    >
                      <span className="font-medium">{head}</span>
                      {rest.length > 0 && (
                        <span className={`ml-1 text-xs ${mutedText}`}>{rest.join(',').trim()}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {showPinTabs && (
        <div className={`shrink-0 border-b ${borderCls} transition-all duration-300 ${minimized ? 'h-0 overflow-hidden border-b-0' : ''}`}>
          <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
            {interactivePins.map((pin) => (
              <div key={pin.id} className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => activatePin(pin.id)}
                  title={pin.label}
                  className={`${pillBase} max-w-25 ${activePinId === pin.id ? pillOn : pillIdle}`}
                >
                  <span className="truncate">{pin.label}</span>
                </button>
                {interactivePins.length > 1 && (
                  <button
                    onClick={() => removePin(pin.id)}
                    title="Remove pin"
                    className={`p-0.5 rounded-full transition-colors ${isDark
                      ? 'text-gph-dark-muted hover:text-gph-dark-ink'
                      : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="flex-1 relative overflow-hidden"
        onMouseEnter={() => setMapHovered(true)}
        onMouseLeave={() => setMapHovered(false)}
      >
        {hasCoords ? (
          <>
            <div
              ref={containerRef}
              className="w-full h-full"
              style={{ visibility: minimized ? 'hidden' : 'visible' }}
            />

            {!minimized && fullscreenBtn}

            {zoomControls === 'hover-buttons' && !minimized && mapHovered && (
              <div className="absolute right-3 bottom-6 flex flex-col gap-1 z-10">
                <button onClick={zoomIn}
                  className={`w-8 h-8 rounded-lg text-lg font-bold flex items-center justify-center backdrop-blur-sm transition-colors ${btnCls}`}>
                  +
                </button>
                <button onClick={zoomOut}
                  className={`w-8 h-8 rounded-lg text-lg font-bold flex items-center justify-center backdrop-blur-sm transition-colors ${btnCls}`}>
                  −
                </button>
              </div>
            )}

            {!minimized && cardOverlay}
          </>
        ) : (
          !minimized && (
            <div className={`flex flex-col items-center justify-center h-full gap-2 ${isDark ? 'bg-gph-dark-card' : 'bg-gray-50'}`}>
              <svg className={`w-8 h-8 ${mutedText}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 6.75V15m6-6v8.25m.503-10.498l4.875 2.437c.381.19.622.58.622 1.006V17.25a.75.75 0 01-.621.74l-5.03.88a1.5 1.5 0 01-.506.02L9.503 18.13a1.5 1.5 0 00-.506.02l-3.984.743A.75.75 0 014.5 18.13V7.87a.75.75 0 01.372-.648l4.5-2.25a.75.75 0 01.632-.012z" />
              </svg>
              <p className={`text-xs ${mutedText}`}>No location data</p>
            </div>
          )
        )}
      </div>

    </div>
  );
}
