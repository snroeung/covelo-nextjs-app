'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { trpc } from '@/lib/trpc-client';
import type { TripPin } from '@/lib/trips';

const MAPBOX_TOKEN  = process.env.NEXT_PUBLIC_MAPBOX_API_KEY ?? '';
const POI_SOURCE    = 'poi-markers';
const POI_LAYER     = 'poi-markers';
const RADIUS_SOURCE = 'radius-circle';
const RADIUS_FILL   = 'radius-circle-fill';
const RADIUS_LINE   = 'radius-circle-line';
const SEARCH_RADIUS = 500; // metres

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

// ─── POI filters ──────────────────────────────────────────────────────────────

type PoiCategory = 'restaurant' | 'cafe' | 'bar' | 'attraction' | 'museum' | 'hotel';

const POI_FILTERS: { id: PoiCategory; label: string; emoji: string; category: string }[] = [
  { id: 'restaurant', label: 'Food',    emoji: '🍽', category: 'restaurant'        },
  { id: 'cafe',       label: 'Cafes',   emoji: '☕', category: 'cafe_coffee_house'  },
  { id: 'bar',        label: 'Bars',    emoji: '🍸', category: 'bar'               },
  { id: 'attraction', label: 'Sights',  emoji: '🏛', category: 'tourist_attraction' },
  { id: 'museum',     label: 'Museums', emoji: '🖼', category: 'museum'            },
  { id: 'hotel',      label: 'Hotels',  emoji: '🏨', category: 'hotel'             },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapPin {
  id: string;
  label: string;
  lng: number;
  lat: number;
  markerEl: HTMLDivElement;
  marker: mapboxgl.Marker;
}

type PoiFeatureCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { name: string; address: string };
  }[];
};

interface GeocodingFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRadiusGeoJSON(centerLng: number, centerLat: number) {
  const steps = 64;
  const coords: [number, number][] = [];
  const latScale = SEARCH_RADIUS / 111_320;
  const lngScale = SEARCH_RADIUS / (111_320 * Math.cos((centerLat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    coords.push([centerLng + lngScale * Math.cos(angle), centerLat + latScale * Math.sin(angle)]);
  }
  return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [coords] }, properties: {} };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TripMap({
  lat, lng, destination, isDark, borderCls, minimized, onToggleMinimize, onAddActivity,
  initialPins, onPinsChange,
}: TripMapProps) {
  // ── Map refs ────────────────────────────────────────────────────────────────
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<mapboxgl.Map | null>(null);
  const activeFilterRef = useRef<PoiCategory | null>(null);
  const interactionsRef = useRef(false);
  const dragDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDebRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openPopupRef    = useRef<mapboxgl.Popup | null>(null);
  // Suppress persistence calls while restoring saved pins on init
  const isRestoringRef  = useRef(false);

  // ── Multi-pin refs ──────────────────────────────────────────────────────────
  const pinsRef          = useRef<MapPin[]>([]);
  const activePinIdRef   = useRef<string | null>(null);
  const poiCacheRef      = useRef<Map<string, PoiFeatureCollection>>(new Map());
  const onPinsChangeRef  = useRef(onPinsChange);
  const initialPinsRef   = useRef(initialPins);

  onPinsChangeRef.current = onPinsChange;
  initialPinsRef.current  = initialPins;

  // ── State ───────────────────────────────────────────────────────────────────
  const [pins, setPins]               = useState<MapPin[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<PoiCategory | null>(null);
  const [loadingPoi, setLoadingPoi]   = useState(false);
  // Debounced drag update — triggers re-fetch effect
  const [pinPos, setPinPos]           = useState<{ pinId: string; lng: number; lat: number } | null>(null);
  // Searchbox
  const [showSearch, setShowSearch]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingFeature[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchBoxRef       = useRef<HTMLDivElement>(null);
  const onAddActivityRef   = useRef(onAddActivity);

  onAddActivityRef.current = onAddActivity;

  const hasCoords = lat != null && lng != null && (lat !== 0 || lng !== 0);

  // ── Radius circle ──────────────────────────────────────────────────────────

  function addRadiusLayer(map: mapboxgl.Map, centerLng: number, centerLat: number) {
    const data = makeRadiusGeoJSON(centerLng, centerLat);
    if (map.getSource(RADIUS_SOURCE)) {
      (map.getSource(RADIUS_SOURCE) as mapboxgl.GeoJSONSource).setData(data);
    } else {
      map.addSource(RADIUS_SOURCE, { type: 'geojson', data });
      map.addLayer({ id: RADIUS_FILL, type: 'fill', source: RADIUS_SOURCE,
        paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.08 } });
      map.addLayer({ id: RADIUS_LINE, type: 'line', source: RADIUS_SOURCE,
        paint: { 'line-color': '#6366f1', 'line-width': 1.5, 'line-dasharray': [3, 2] } });
    }
  }

  // ── POI layer ──────────────────────────────────────────────────────────────

  function addPoiLayer(map: mapboxgl.Map, fc: PoiFeatureCollection) {
    if (map.getSource(POI_SOURCE)) {
      (map.getSource(POI_SOURCE) as mapboxgl.GeoJSONSource).setData(fc);
      return;
    }
    map.addSource(POI_SOURCE, { type: 'geojson', data: fc });
    map.addLayer({ id: POI_LAYER, type: 'circle', source: POI_SOURCE,
      paint: { 'circle-color': '#6366f1', 'circle-radius': 7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
    map.addInteraction('poi-click', {
      type: 'click', target: { layerId: POI_LAYER },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: (e: any) => {
        const { name, address } = e.feature.properties as { name: string; address: string };
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        openPopupRef.current?.remove();
        const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: true, maxWidth: '260px', className: 'poi-popup' })
          .setLngLat(e.feature.geometry.coordinates.slice() as [number, number])
          .setHTML(
            `<div style="padding:0;overflow:hidden;border-radius:8px">` +
            `<div class="poi-photo-wrap" style="width:100%;height:130px;background:#e2e8f0;position:relative;overflow:hidden">` +
            `<img class="poi-photo" src="" alt="" style="width:100%;height:100%;object-fit:cover;display:none" />` +
            `<div class="poi-photo-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:36px">📍</div>` +
            `</div>` +
            `<div style="padding:10px 10px 8px">` +
            `<div style="font-size:13px;font-weight:700;line-height:1.3;margin-bottom:3px">${esc(name)}</div>` +
            `<div style="font-size:11px;opacity:0.6;line-height:1.5;margin-bottom:8px">${esc(address)}</div>` +
            `<button class="poi-add-btn" data-poi-name="${esc(name)}" data-poi-address="${esc(address)}" style="font-size:11px;font-weight:600;color:#6366f1;background:none;border:none;padding:0;cursor:pointer;">+ Add to trip</button>` +
            `</div></div>`,
          );
        openPopupRef.current = popup;
        popup.addTo(map);

        // Fetch photo asynchronously and inject into the popup
        trpc.places.getPhoto.query({ name, address }).then((photoUrl) => {
          if (!photoUrl) return;
          const el = popup.getElement();
          if (!el) return;
          const img = el.querySelector<HTMLImageElement>('.poi-photo');
          const placeholder = el.querySelector<HTMLElement>('.poi-photo-placeholder');
          if (img) { img.src = photoUrl; img.style.display = 'block'; }
          if (placeholder) placeholder.style.display = 'none';
        }).catch(() => {});
      },
    });
    map.addInteraction('poi-enter', { type: 'mouseenter', target: { layerId: POI_LAYER },
      handler: () => { map.getCanvas().style.cursor = 'pointer'; } });
    map.addInteraction('poi-leave', { type: 'mouseleave', target: { layerId: POI_LAYER },
      handler: () => { map.getCanvas().style.cursor = ''; } });
    interactionsRef.current = true;
  }

  // ── Clear POI layer (keeps cache intact) ──────────────────────────────────

  const clearMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(POI_LAYER))   map.removeLayer(POI_LAYER);
    if (map.getSource(POI_SOURCE)) map.removeSource(POI_SOURCE);
    if (interactionsRef.current) {
      map.removeInteraction('poi-click');
      map.removeInteraction('poi-enter');
      map.removeInteraction('poi-leave');
      interactionsRef.current = false;
    }
  }, []);

  // ── Fetch POIs for a specific pin ──────────────────────────────────────────

  const fetchMarkersForPin = useCallback(async (
    pinId: string,
    filter: typeof POI_FILTERS[number],
    map: mapboxgl.Map,
    centerLng: number,
    centerLat: number,
  ) => {
    setLoadingPoi(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(filter.category)}` +
        `?proximity=${centerLng},${centerLat}&language=en&access_token=${MAPBOX_TOKEN}`,
      );
      const data = await res.json() as {
        features: {
          geometry: { coordinates: [number, number] };
          properties: { name: string; full_address?: string; address?: string; place_formatted?: string };
        }[];
      };

      // Abort if filter or active pin changed while awaiting
      if (activeFilterRef.current !== filter.id) return;
      if (activePinIdRef.current !== pinId) return;

      const toRad = (d: number) => (d * Math.PI) / 180;
      const withinRadius = data.features.filter((f) => {
        const [fLng, fLat] = f.geometry.coordinates;
        const dLat = toRad(fLat - centerLat);
        const dLng = toRad(fLng - centerLng);
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(centerLat)) * Math.cos(toRad(fLat)) * Math.sin(dLng / 2) ** 2;
        return 2 * 6_371_000 * Math.asin(Math.sqrt(a)) <= SEARCH_RADIUS;
      });

      const fc: PoiFeatureCollection = {
        type: 'FeatureCollection',
        features: withinRadius.map((f) => {
          const name    = f.properties.name;
          const rawAddr = f.properties.full_address ?? f.properties.place_formatted ?? f.properties.address ?? '';
          const address = rawAddr.startsWith(name) ? rawAddr.slice(name.length).replace(/^,\s*/, '') : rawAddr;
          return { type: 'Feature', geometry: { type: 'Point', coordinates: f.geometry.coordinates }, properties: { name, address } };
        }),
      };

      poiCacheRef.current.set(`${pinId}:${filter.id}`, fc);
      const add = () => addPoiLayer(map, fc);
      if (map.loaded()) add(); else map.once('load', add);
    } catch {
      // silently fail
    } finally {
      setLoadingPoi(false);
    }
  }, []);

  // ── Activate a pin (switch radius + POI layer to it) ──────────────────────

  const activatePin = useCallback((pinId: string) => {
    const map = mapRef.current;
    if (!map) return;
    const pin = pinsRef.current.find((p) => p.id === pinId);
    if (!pin) return;

    // Update marker visual states
    for (const p of pinsRef.current) {
      p.markerEl.style.cssText = p.id === pinId ? ACTIVE_PIN_CSS : IDLE_PIN_CSS;
    }

    activePinIdRef.current = pinId;
    setActivePinId(pinId);
    addRadiusLayer(map, pin.lng, pin.lat);
    map.flyTo({ center: [pin.lng, pin.lat], duration: 500 });

    const filterId = activeFilterRef.current;
    if (!filterId) return;

    const cacheKey = `${pinId}:${filterId}`;
    const cached = poiCacheRef.current.get(cacheKey);
    if (cached) {
      const add = () => addPoiLayer(map, cached);
      if (map.loaded()) add(); else map.once('load', add);
    } else {
      const filter = POI_FILTERS.find((f) => f.id === filterId);
      if (filter) fetchMarkersForPin(pinId, filter, map, pin.lng, pin.lat);
    }
  }, [fetchMarkersForPin]);

  // ── Spawn a new pin on the map ────────────────────────────────────────────

  function spawnPin(map: mapboxgl.Map, pLng: number, pLat: number, label: string, pinId?: string): MapPin {
    // Deactivate current active pin visually
    for (const p of pinsRef.current) p.markerEl.style.cssText = IDLE_PIN_CSS;

    const el = document.createElement('div');
    el.style.cssText = ACTIVE_PIN_CSS;

    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([pLng, pLat])
      .addTo(map);

    const id = pinId ?? (pinsRef.current.length === 0 ? 'default' : crypto.randomUUID());
    const pin: MapPin = { id, label, lng: pLng, lat: pLat, markerEl: el, marker };

    // Click → activate this pin
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      activatePin(pin.id);
    });

    // Drag → move radius immediately, debounce re-fetch 1 s
    marker.on('dragend', () => {
      const { lng: newLng, lat: newLat } = marker.getLngLat();
      const found = pinsRef.current.find((p) => p.id === pin.id);
      if (found) { found.lng = newLng; found.lat = newLat; }
      setPins([...pinsRef.current]);
      persistPins();
      for (const k of poiCacheRef.current.keys()) {
        if (k.startsWith(`${pin.id}:`)) poiCacheRef.current.delete(k);
      }
      if (pin.id === activePinIdRef.current) {
        addRadiusLayer(map, newLng, newLat);
        if (dragDebounceRef.current) clearTimeout(dragDebounceRef.current);
        dragDebounceRef.current = setTimeout(() => {
          setPinPos({ pinId: pin.id, lng: newLng, lat: newLat });
        }, 1000);
      }
    });

    pinsRef.current = [...pinsRef.current, pin];
    activePinIdRef.current = id;
    setPins([...pinsRef.current]);
    setActivePinId(id);
    addRadiusLayer(map, pLng, pLat);
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
    // Clear its cache
    for (const k of poiCacheRef.current.keys()) {
      if (k.startsWith(`${pinId}:`)) poiCacheRef.current.delete(k);
    }
    pinsRef.current = pinsRef.current.filter((p) => p.id !== pinId);
    setPins([...pinsRef.current]);
    persistPins();
    // If removed pin was active, activate the last remaining
    if (activePinIdRef.current === pinId) {
      if (pinsRef.current.length > 0) {
        activatePin(pinsRef.current[pinsRef.current.length - 1].id);
      } else {
        activePinIdRef.current = null;
        setActivePinId(null);
        clearMarkers();
      }
    }
  }

  // ── Toggle filter ──────────────────────────────────────────────────────────

  function toggleFilter(filter: typeof POI_FILTERS[number]) {
    const pinId = activePinIdRef.current;
    if (activeFilter === filter.id) {
      clearMarkers(); setActiveFilter(null); activeFilterRef.current = null; return;
    }
    if (!hasCoords || !mapRef.current || !pinId) return;
    setActiveFilter(filter.id);
    activeFilterRef.current = filter.id;
    const map = mapRef.current;
    const cacheKey = `${pinId}:${filter.id}`;
    const cached = poiCacheRef.current.get(cacheKey);
    if (cached) {
      const add = () => addPoiLayer(map, cached);
      if (map.loaded()) add(); else map.once('load', add);
    } else {
      const pin = pinsRef.current.find((p) => p.id === pinId);
      if (pin) fetchMarkersForPin(pinId, filter, map, pin.lng, pin.lat);
    }
  }

  // ── Geocoding search ──────────────────────────────────────────────────────

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
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
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
      const saved = initialPinsRef.current;
      if (saved && saved.length > 0) {
        isRestoringRef.current = true;
        for (const p of saved) spawnPin(map, p.lng, p.lat, p.label, p.id);
        isRestoringRef.current = false;
      } else {
        spawnPin(map, initLng, initLat, destination.split(',')[0], 'default');
      }
    });

    // Delegated handler for "Add to trip" buttons inside Mapbox popups
    function onContainerClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.poi-add-btn');
      if (btn) {
        const name = btn.dataset.poiName ?? '';
        const address = btn.dataset.poiAddress ?? '';
        onAddActivityRef.current?.(name, address);
        openPopupRef.current?.remove();
        openPopupRef.current = null;
      }
    }
    // Capture the element so cleanup can reliably remove the listener even
    // after the ref is cleared (avoids double-listener in React StrictMode).
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

  // ── Re-fetch after drag debounce ──────────────────────────────────────────

  useEffect(() => {
    if (!pinPos || !mapRef.current) return;
    const { pinId, lng: pLng, lat: pLat } = pinPos;
    if (activePinIdRef.current !== pinId) return;
    const filterId = activeFilterRef.current;
    if (!filterId) return;
    const filter = POI_FILTERS.find((f) => f.id === filterId);
    if (filter) fetchMarkersForPin(pinId, filter, mapRef.current, pLng, pLat);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinPos]);

  // ── Resize after expand ───────────────────────────────────────────────────

  useEffect(() => {
    if (minimized) return;
    const t = setTimeout(() => mapRef.current?.resize(), 310);
    return () => clearTimeout(t);
  }, [minimized]);

  // ── Theme change — re-add WebGL layers only (markers persist) ─────────────

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    map.setStyle(isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12');
    interactionsRef.current = false;
    map.once('style.load', () => {
      const activePin = pinsRef.current.find((p) => p.id === activePinIdRef.current);
      if (activePin) addRadiusLayer(map, activePin.lng, activePin.lat);
      const filterId = activeFilterRef.current;
      const pinId = activePinIdRef.current;
      if (filterId && pinId) {
        const cached = poiCacheRef.current.get(`${pinId}:${filterId}`);
        if (cached) addPoiLayer(map, cached);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]);

  // ── Geocode debounce ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!showSearch) return;
    if (geocodeDebRef.current) clearTimeout(geocodeDebRef.current);
    geocodeDebRef.current = setTimeout(() => runGeocode(searchQuery), 300);
    return () => { if (geocodeDebRef.current) clearTimeout(geocodeDebRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, showSearch]);

  // ── Searchbox click-outside ───────────────────────────────────────────────

  useEffect(() => {
    if (!showSearch) return;
    function onDown(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showSearch]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function zoomIn()  { mapRef.current?.zoomIn()  }
  function zoomOut() { mapRef.current?.zoomOut() }

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
  const searchBg  = isDark ? 'bg-cv-blue-900 border-cv-blue-700' : 'bg-white border-cv-blue-200';

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

      {/* ── Pin tabs ────────────────────────────────────────────────────────── */}
      <div className={`shrink-0 border-b ${borderCls} transition-all duration-300 ${minimized ? 'h-0 overflow-hidden border-b-0' : ''}`}>
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">

          {/* Add pin button */}
          <button
            onClick={() => { setShowSearch(true); setSearchQuery(''); setSearchResults([]); }}
            disabled={!hasCoords}
            className={`${pillBase} ${isDark ? 'bg-cv-blue-800/60 text-cv-blue-400 hover:bg-cv-blue-700 hover:text-white disabled:opacity-40' : 'bg-cv-blue-50 text-cv-blue-500 hover:bg-cv-blue-100 disabled:opacity-40'}`}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add pin</span>
          </button>

          {/* One tab per pin */}
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
                  className={`p-0.5 rounded-full transition-colors ${isDark ? 'text-cv-blue-700 hover:text-cv-blue-300' : 'text-cv-blue-300 hover:text-cv-blue-600'}`}
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

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div className={`shrink-0 border-b ${borderCls} transition-all duration-300 ${minimized ? 'h-0 overflow-hidden border-b-0' : ''}`}>
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto">
          {POI_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => toggleFilter(f)}
              className={`${pillBase} ${activeFilter === f.id ? pillOn : pillIdle}`}
            >
              <span>{f.emoji}</span>
              <span>{f.label}</span>
              {loadingPoi && activeFilter === f.id && (
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
            </button>
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
                {/* ── Search overlay ─────────────────────────────────────── */}
                {showSearch && (
                  <div ref={searchBoxRef} className="absolute inset-x-3 top-3 z-20">
                    <div className={`rounded-xl border shadow-xl overflow-hidden ${searchBg}`}>

                      {/* Input row */}
                      <div className="flex items-center gap-2 px-3">
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
                          autoFocus
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setSearchResults([]); } }}
                          placeholder="Search for a location…"
                          className={`flex-1 py-2.5 text-sm bg-transparent outline-none ${isDark ? 'text-white placeholder:text-cv-blue-500' : 'text-cv-blue-950 placeholder:text-cv-blue-400'}`}
                        />
                        <button
                          onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
                          className={`shrink-0 p-1 rounded transition-colors ${mutedText}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Results */}
                      {searchResults.length > 0 && (
                        <ul className={`border-t ${isDark ? 'border-cv-blue-800' : 'border-cv-blue-100'}`}>
                          {searchResults.map((s) => {
                            const [head, ...rest] = s.place_name.split(',');
                            return (
                              <li key={s.id}>
                                <button
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => handleSearchSelect(s)}
                                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${isDark ? 'text-cv-blue-100 hover:bg-cv-blue-800' : 'text-cv-blue-950 hover:bg-cv-blue-50'}`}
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
                  </div>
                )}

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
