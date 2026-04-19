'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { trpc } from '@/lib/trpc-client';
import type { TripPin } from '@/lib/trips';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_KEY ?? '';

// POI label layers present in both streets-v12 and dark-v11
const CLICKABLE_POI_LAYERS = ['poi-label', 'airport-label', 'transit-label'];

// ─── Pin visual styles ────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapPin {
  id: string;
  label: string;
  lng: number;
  lat: number;
  markerEl: HTMLDivElement;
  marker: mapboxgl.Marker;
}

interface GeocodingFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

interface TripMapProps {
  lat?: number;
  lng?: number;
  destination: string;
  isDark: boolean;
  borderCls: string;
  minimized: boolean;
  onToggleMinimize: () => void;
  onAddActivity?: (name: string, address: string) => void;
  initialPins?: TripPin[];
  onPinsChange?: (pins: TripPin[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TripMap({
  lat, lng, destination, isDark, borderCls, minimized, onToggleMinimize, onAddActivity,
  initialPins, onPinsChange,
}: TripMapProps) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<mapboxgl.Map | null>(null);
  const geocodeDebRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openPopupRef    = useRef<mapboxgl.Popup | null>(null);
  const isRestoringRef  = useRef(false);

  const pinsRef         = useRef<MapPin[]>([]);
  const activePinIdRef  = useRef<string | null>(null);
  const onPinsChangeRef = useRef(onPinsChange);
  const initialPinsRef  = useRef(initialPins);
  const onAddActivityRef = useRef(onAddActivity);

  onPinsChangeRef.current  = onPinsChange;
  initialPinsRef.current   = initialPins;
  onAddActivityRef.current = onAddActivity;

  // ── State ─────────────────────────────────────────────────────────────────
  const [pins, setPins]               = useState<MapPin[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingFeature[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const hasCoords = lat != null && lng != null && (lat !== 0 || lng !== 0);

  // ── Activate a pin ────────────────────────────────────────────────────────

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
  }, []);

  // ── Spawn a new pin ───────────────────────────────────────────────────────

  function spawnPin(map: mapboxgl.Map, pLng: number, pLat: number, label: string, pinId?: string): MapPin {
    for (const p of pinsRef.current) p.markerEl.style.cssText = IDLE_PIN_CSS;

    const el = document.createElement('div');
    el.style.cssText = ACTIVE_PIN_CSS;

    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([pLng, pLat])
      .addTo(map);

    const id = pinId ?? (pinsRef.current.length === 0 ? 'default' : crypto.randomUUID());
    const pin: MapPin = { id, label, lng: pLng, lat: pLat, markerEl: el, marker };

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      activatePin(pin.id);
    });

    marker.on('dragend', () => {
      const { lng: newLng, lat: newLat } = marker.getLngLat();
      const found = pinsRef.current.find((p) => p.id === pin.id);
      if (found) { found.lng = newLng; found.lat = newLat; }
      setPins([...pinsRef.current]);
      persistPins();
    });

    pinsRef.current = [...pinsRef.current, pin];
    activePinIdRef.current = id;
    setPins([...pinsRef.current]);
    setActivePinId(id);
    if (!isRestoringRef.current) persistPins();

    return pin;
  }

  function persistPins() {
    onPinsChangeRef.current?.(
      pinsRef.current.map(({ id, label, lng, lat }) => ({ id, label, lng, lat })),
    );
  }

  // ── Remove a pin ──────────────────────────────────────────────────────────

  function removePin(pinId: string) {
    const pin = pinsRef.current.find((p) => p.id === pinId);
    if (!pin) return;
    pin.marker.remove();
    pinsRef.current = pinsRef.current.filter((p) => p.id !== pinId);
    setPins([...pinsRef.current]);
    persistPins();
    if (activePinIdRef.current === pinId) {
      if (pinsRef.current.length > 0) {
        activatePin(pinsRef.current[pinsRef.current.length - 1].id);
      } else {
        activePinIdRef.current = null;
        setActivePinId(null);
      }
    }
  }

  // ── Geocoding search (for adding pins) ────────────────────────────────────

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
    spawnPin(map, fLng, fLat, label);
    setSearchQuery('');
    setSearchResults([]);
  }

  // ── Place popup: name from map feature, address from reverse geocode ───────
  //
  // Renders immediately with the name, then fills in the address and photo
  // asynchronously as each resolves — same pattern as Google Maps click UX.

  function buildPopupHTML(name: string): string {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return (
      `<div style="padding:0;overflow:hidden;border-radius:8px">` +
      `<div class="poi-photo-wrap" style="width:100%;height:130px;background:#e2e8f0;position:relative;overflow:hidden">` +
      `<img class="poi-photo" src="" alt="" style="width:100%;height:100%;object-fit:cover;display:none" />` +
      `<div class="poi-photo-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:36px">📍</div>` +
      `</div>` +
      `<div style="padding:10px 10px 8px">` +
      `<div style="font-size:13px;font-weight:700;line-height:1.3;margin-bottom:3px">${esc(name)}</div>` +
      `<div class="poi-address" style="font-size:11px;opacity:0.6;line-height:1.5;margin-bottom:8px">Looking up address…</div>` +
      `<button class="poi-add-btn" data-poi-name="${esc(name)}" data-poi-address="" ` +
      `style="font-size:11px;font-weight:600;color:#6366f1;background:none;border:none;padding:0;cursor:pointer;">+ Add to trip</button>` +
      `</div></div>`
    );
  }

  async function showPlacePopup(map: mapboxgl.Map, name: string, coords: [number, number]) {
    openPopupRef.current?.remove();
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: true,
      maxWidth: '260px',
      className: 'poi-popup',
    })
      .setLngLat(coords)
      .setHTML(buildPopupHTML(name))
      .addTo(map);
    openPopupRef.current = popup;

    // Reverse geocode and photo fetch run in parallel
    const [address] = await Promise.all([
      // Reverse geocode for street address
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords[0]},${coords[1]}.json` +
        `?access_token=${MAPBOX_TOKEN}&types=address,poi&limit=1`,
      )
        .then((r) => r.json() as Promise<{ features: { place_name: string }[] }>)
        .then((data) => {
          const raw = data.features?.[0]?.place_name ?? '';
          return raw.startsWith(name) ? raw.slice(name.length).replace(/^,\s*/, '') : raw;
        })
        .catch(() => ''),

      // Photo fetch — updates DOM directly when it resolves
      trpc.places.getPhoto.query({ name, address: '' })
        .then((photoUrl) => {
          if (!photoUrl) return;
          const el = popup.getElement();
          if (!el) return;
          const img = el.querySelector<HTMLImageElement>('.poi-photo');
          const placeholder = el.querySelector<HTMLElement>('.poi-photo-placeholder');
          if (img) { img.src = photoUrl; img.style.display = 'block'; }
          if (placeholder) placeholder.style.display = 'none';
        })
        .catch(() => {}),
    ]);

    // Patch address into the popup DOM and the "Add to trip" button's data attribute
    const el = popup.getElement();
    if (!el) return;
    const addrEl = el.querySelector<HTMLElement>('.poi-address');
    const btn    = el.querySelector<HTMLElement>('.poi-add-btn');
    if (addrEl) addrEl.textContent = address;
    if (btn)    btn.dataset.poiAddress = address;
  }

  // ── Init map ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || !hasCoords) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const initLng = lng!;
    const initLat = lat!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12',
      center: [initLng, initLat],
      zoom: 14,
      attributionControl: false,
    });

    map.once('load', () => {
      // Restore saved pins or place default
      const saved = initialPinsRef.current;
      if (saved && saved.length > 0) {
        isRestoringRef.current = true;
        for (const p of saved) spawnPin(map, p.lng, p.lat, p.label, p.id);
        isRestoringRef.current = false;
      } else {
        spawnPin(map, initLng, initLat, destination.split(',')[0], 'default');
      }

      // Click on a labeled POI → show name + address popup
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: CLICKABLE_POI_LAYERS });
        if (features.length === 0) return;
        const feature = features[0];
        const props = feature.properties ?? {};
        const name = ((props.name_en ?? props.name) as string | undefined)?.trim() ?? '';
        if (!name) return;
        // Point geometry guaranteed for symbol layers
        const geom = feature.geometry as { type: 'Point'; coordinates: [number, number] };
        void showPlacePopup(map, name, geom.coordinates);
      });

      // Pointer cursor when hovering labelled POIs
      for (const layer of CLICKABLE_POI_LAYERS) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      }
    });

    // Delegated handler for "Add to trip" buttons inside popups
    function onContainerClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.poi-add-btn');
      if (btn) {
        const name    = btn.dataset.poiName    ?? '';
        const address = btn.dataset.poiAddress ?? '';
        onAddActivityRef.current?.(name, address);
        openPopupRef.current?.remove();
        openPopupRef.current = null;
      }
    }
    const mapContainer = containerRef.current;
    mapContainer?.addEventListener('click', onContainerClick);

    mapRef.current = map;
    return () => {
      mapContainer?.removeEventListener('click', onContainerClick);
      map.remove();
      mapRef.current = null;
      pinsRef.current = [];
      activePinIdRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCoords]);

  // ── Resize after expand ───────────────────────────────────────────────────

  useEffect(() => {
    if (minimized) return;
    const t = setTimeout(() => mapRef.current?.resize(), 310);
    return () => clearTimeout(t);
  }, [minimized]);

  // ── Theme change ──────────────────────────────────────────────────────────

  useEffect(() => {
    mapRef.current?.setStyle(isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12');
  }, [isDark]);

  // ── Geocode debounce ──────────────────────────────────────────────────────

  useEffect(() => {
    if (geocodeDebRef.current) clearTimeout(geocodeDebRef.current);
    geocodeDebRef.current = setTimeout(() => runGeocode(searchQuery), 300);
    return () => { if (geocodeDebRef.current) clearTimeout(geocodeDebRef.current); };
  }, [searchQuery]);

  // ── Searchbox click-outside ───────────────────────────────────────────────

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function zoomIn()  { mapRef.current?.zoomIn(); }
  function zoomOut() { mapRef.current?.zoomOut(); }

  // ── Styles ────────────────────────────────────────────────────────────────

  const bg        = isDark ? 'bg-cv-blue-950' : 'bg-white';
  const mutedText = isDark ? 'text-cv-blue-400' : 'text-cv-blue-400';
  const pillBase  = 'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 whitespace-nowrap';
  const pillIdle  = isDark
    ? 'bg-cv-blue-800 text-cv-blue-300 hover:bg-cv-blue-700'
    : 'bg-cv-blue-50 text-cv-blue-600 hover:bg-cv-blue-100';
  const pillOn    = isDark ? 'bg-cv-blue-500 text-white' : 'bg-cv-blue-600 text-white';
  const btnCls    = isDark
    ? 'bg-cv-blue-900/80 border border-cv-blue-700 text-cv-blue-300 hover:bg-cv-blue-800 hover:text-white'
    : 'bg-white/80 border border-cv-blue-200 text-cv-blue-600 hover:bg-cv-blue-50';

  return (
    <div className={`flex flex-col h-full border-l overflow-hidden ${borderCls} ${bg}`}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={`shrink-0 flex items-center justify-between px-3 py-2.5 border-b ${borderCls}`}>
        {!minimized && (
          <div className="flex items-center gap-1.5 min-w-0 mr-2">
            <svg className={`w-3.5 h-3.5 shrink-0 ${mutedText}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
            </svg>
            <span className={`text-xs font-semibold truncate ${isDark ? 'text-cv-blue-200' : 'text-cv-blue-800'}`}>
              {destination.split(',')[0]}
            </span>
          </div>
        )}
        <button
          onClick={onToggleMinimize}
          title={minimized ? 'Expand map' : 'Minimize map'}
          className={`shrink-0 p-1 rounded transition-colors ${mutedText} ${minimized ? 'mx-auto' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            {minimized
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            }
          </svg>
        </button>
      </div>

      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div
        ref={searchBoxRef}
        className={`shrink-0 border-b ${borderCls} transition-all duration-300 ${minimized ? 'h-0 overflow-hidden border-b-0' : 'relative'}`}
      >
        <div className={`flex items-center gap-2 px-3 ${isDark ? 'bg-cv-blue-950' : 'bg-white'}`}>
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
              ? 'text-white placeholder:text-cv-blue-500'
              : 'text-cv-blue-950 placeholder:text-cv-blue-400'}`}
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

        {/* Results dropdown */}
        {searchResults.length > 0 && (
          <ul className={`absolute inset-x-0 top-full z-20 border-t shadow-xl ${isDark
            ? 'bg-cv-blue-900 border-cv-blue-700'
            : 'bg-white border-cv-blue-100'}`}>
            {searchResults.map((s) => {
              const [head, ...rest] = s.place_name.split(',');
              return (
                <li key={s.id}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSearchSelect(s)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${isDark
                      ? 'text-cv-blue-100 hover:bg-cv-blue-800'
                      : 'text-cv-blue-950 hover:bg-cv-blue-50'}`}
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

      {/* ── Pin tabs ────────────────────────────────────────────────────────── */}
      <div className={`shrink-0 border-b ${borderCls} transition-all duration-300 ${minimized ? 'h-0 overflow-hidden border-b-0' : ''}`}>
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">

          {pins.map((pin) => (
            <div key={pin.id} className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => activatePin(pin.id)}
                title={pin.label}
                className={`${pillBase} max-w-25 ${activePinId === pin.id ? pillOn : pillIdle}`}
              >
                <span className="truncate">{pin.label}</span>
              </button>
              {pins.length > 1 && (
                <button
                  onClick={() => removePin(pin.id)}
                  title="Remove pin"
                  className={`p-0.5 rounded-full transition-colors ${isDark
                    ? 'text-cv-blue-700 hover:text-cv-blue-300'
                    : 'text-cv-blue-300 hover:text-cv-blue-600'}`}
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

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {hasCoords ? (
          <>
            <div
              ref={containerRef}
              className="w-full h-full"
              style={{ visibility: minimized ? 'hidden' : 'visible' }}
            />

            {!minimized && (
              <>
                {/* ── Zoom controls ──────────────────────────────────────── */}
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
              </>
            )}
          </>
        ) : (
          !minimized && (
            <div className={`flex flex-col items-center justify-center h-full gap-2 ${isDark ? 'bg-cv-blue-900' : 'bg-cv-blue-50'}`}>
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
