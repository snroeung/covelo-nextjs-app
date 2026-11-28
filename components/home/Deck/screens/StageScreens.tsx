'use client';

import type { CSSProperties } from 'react';
import {
  FLIGHTS, SORT_ORDER, SORT_TABS, EXAMPLE_ROUTES, SEARCHING_WITH, BOARD_POSTS,
  CPP_BASE, CPP_BONUS,
} from '../steps';
import { ptsForCpp, type DeckState } from '../useDeckScript';

// All stage screens are display-only (the stage is inert / aria-hidden /
// pointer-events:none). They read DeckState and render; the `press` ring is the
// `.cv-hot` class on whichever control the script is "clicking". Colours come
// from the scoped `.cv-stage` tokens in globals.css. SAMPLE DATA throughout.

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const hot = (on: boolean) => (on ? 'cv-hot' : '');

const cap: CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: 'var(--c-6b7079)' };

function Chrome({ children }: { children: React.ReactNode }) {
  return <div className="cv-pop" style={{ height: 600 }}>{children}</div>;
}

// ── S1 Search ─────────────────────────────────────────────────────────────────
function SearchScreen({ s }: { s: DeckState }) {
  const toText = s.toSel ? 'San Francisco Interna…' : (s.toTyped || '') + '|';
  const toBorder = s.toSel ? 'var(--l-e6e7ea)' : 'var(--l-9cc7a2)';
  const dropdown = !s.toSel && (s.toTyped || '').length >= 3;
  const searchOff = !s.toSel || s.searching;
  const searchLabel = s.searching ? 'Searching…' : 'Search →';
  const searchBg = s.toSel && !s.searching ? 'var(--b-14161a)' : 'var(--b-a3a7ae)';
  const field: CSSProperties = { background: 'var(--b-fff)', border: '1px solid var(--l-e6e7ea)', borderRadius: 10, padding: '7px 11px' };
  return (
    <div className="cv-pop" style={{ height: 600, background: 'var(--b-f2f3f5)', padding: '24px 28px' }}>
      <div style={{ background: 'var(--b-fff)', border: '1px solid var(--l-e6e7ea)', borderRadius: 16, padding: '24px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div>
            <div className="m" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-4b5058)' }}>SEARCH · EVERY PORTAL, ONE QUERY</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-.035em', marginTop: 8 }}>Find your flight</div>
            <div style={{ fontSize: 14, color: 'var(--c-4b5058)', marginTop: 6, maxWidth: 470, lineHeight: 1.45 }}>Search cash and points side by side across every travel portal — ranked by true cents-per-point value.</div>
          </div>
          <div style={{ display: 'flex', gap: 4, padding: 5, borderRadius: 12, background: 'var(--b-f2f3f5)', border: '1px solid var(--l-e6e7ea)' }}>
            <span style={{ padding: '10px 18px', borderRadius: 9, background: 'var(--b-14161a)', color: 'var(--c-fff)', fontSize: 13, fontWeight: 700 }}>✈ Flights</span>
            <span style={{ padding: '10px 18px', borderRadius: 9, color: 'var(--c-4b5058)', fontSize: 13, fontWeight: 700 }}>Hotels</span>
          </div>
        </div>
        <div style={{ marginTop: 18, background: 'var(--b-f4f5f7)', border: '1px solid var(--l-e6e7ea)', borderRadius: 12, padding: 12, display: 'flex', gap: 8, alignItems: 'stretch', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: 4, borderRadius: 10, background: 'var(--b-fff)', border: '1px solid var(--l-e6e7ea)' }}>
            <span style={{ padding: '7px 12px', borderRadius: 7, background: 'var(--b-14161a)', color: 'var(--c-fff)', fontSize: 11.5, fontWeight: 700 }}>Round trip</span>
            <span style={{ padding: '7px 12px', fontSize: 11.5, fontWeight: 700, color: 'var(--c-4b5058)' }}>One-way</span>
          </div>
          <div style={{ flex: 1.2, ...field }}><div className="m" style={cap}>FROM</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Philadelphia Internati…</div></div>
          <div style={{ flex: 1.2, background: 'var(--b-fff)', border: `1.5px solid ${toBorder}`, borderRadius: 10, padding: '6px 11px', position: 'relative' }}>
            <div className="m" style={cap}>TO</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toText}</div>
            {dropdown && (
              <div style={{ position: 'absolute', left: -1, minWidth: 280, top: 'calc(100% + 4px)', background: 'var(--b-fff)', border: '1px solid var(--l-e6e7ea)', borderRadius: 10, boxShadow: '0 10px 24px rgba(0,0,0,.12)', padding: 4, zIndex: 5 }}>
                <div className={hot(s.press === 'sfo')} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: 10, borderRadius: 7, fontSize: 12.5, fontWeight: 600, background: 'var(--b-f4f5f7)' }}><span style={{ whiteSpace: 'nowrap' }}>San Francisco International</span><span className="m" style={{ color: 'var(--c-6b7079)', marginLeft: 12 }}>SFO</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: 10, fontSize: 12.5, color: 'var(--c-4b5058)' }}><span style={{ whiteSpace: 'nowrap' }}>San Fernando Airport</span><span className="m" style={{ marginLeft: 12 }}>SFD</span></div>
              </div>
            )}
          </div>
          <div style={{ flex: .9, ...field }}><div className="m" style={cap}>DEPART</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>12/05/2026</div></div>
          <div style={{ flex: .9, ...field }}><div className="m" style={cap}>RETURN</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>12/12/2026</div></div>
          <span className={hot(s.press === 'search')} style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'var(--c-fff)', background: searchBg, opacity: searchOff ? 1 : 1 }}>{searchLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <span className="m" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', color: 'var(--c-6b7079)', marginRight: 4 }}>SEARCHING WITH</span>
          {SEARCHING_WITH.map((p) => (
            <span key={p.name} style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--b-f2f3f5)', border: '1px solid var(--l-e6e7ea)', fontSize: 11.5, fontWeight: 700 }}><b style={{ color: 'var(--c-7cb342)' }}>●</b> {p.name} <span className="m" style={{ fontWeight: 500, color: 'var(--c-4b5058)' }}>{p.pts}</span></span>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em', marginTop: 22 }}>Example routes · Philadelphia departures</div>
      <div className="m" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.1em', color: 'var(--c-6b7079)', marginTop: 4, paddingBottom: 10, borderBottom: '1.5px solid var(--l-dfe1e5)' }}>LIVE BOARD</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 10, marginTop: 12 }}>
        {EXAMPLE_ROUTES.map((r) => (
          <div key={r.airline} style={{ background: 'var(--b-fff)', border: '1px solid var(--l-e6e7ea)', borderRadius: 12, padding: 14 }}>
            <div className="m" style={cap}>{r.airline}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>{r.route}</div>
            <div className="m" style={{ fontSize: 10, color: 'var(--c-6b7079)', marginTop: 3 }}>{r.code}</div>
            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 12 }}>{r.price}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── S2 Results ────────────────────────────────────────────────────────────────
function ResultsScreen({ s }: { s: DeckState }) {
  const order = SORT_ORDER[s.sort];
  const flights = order.map((k) => FLIGHTS.find((f) => f.key === k)!);
  return (
    <Chrome>
      <div style={{ height: 600, background: 'var(--b-f2f3f5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px', background: 'var(--b-fff)', borderBottom: '1px solid var(--l-e6e7ea)' }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>PHL → SFO</span><span className="m" style={{ fontSize: 11, color: 'var(--c-6b7079)' }}>Dec 5 – Dec 12 · Round trip · 1 adult · Economy</span>
          <span style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 8, background: 'var(--b-14161a)', color: 'var(--c-fff)', fontSize: 12, fontWeight: 700 }}>Search →</span>
        </div>
        <div style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>14 flights · PHL → SFO</span>
            <div style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 9, background: 'var(--b-fff)', border: '1px solid var(--l-e6e7ea)' }}>
              {SORT_TABS.map(([key, label]) => {
                const active = s.sort === key;
                return <span key={key} className={hot(s.press === key)} style={{ padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: active ? 'var(--b-14161a)' : undefined, color: active ? 'var(--c-fff)' : 'var(--c-4b5058)' }}>{label}</span>;
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {flights.map((f) => (
              <div key={f.key} style={{ background: 'var(--b-fff)', border: '1px solid var(--l-e6e7ea)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 4px' }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: f.logo, color: 'var(--c-fff)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.code}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{f.name}</span>
                  <span className="m" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--c-6b7079)' }}>FROM <b style={{ fontSize: 13, color: 'var(--c-111418)' }}>${f.price}</b></span>
                </div>
                {f.legs.map((l, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '88px 120px 1fr 120px', gap: 12, alignItems: 'center', padding: '6px 16px' }}>
                    <div><div className="m" style={cap}>{l.dir}</div><div className="m" style={{ fontSize: 9.5, color: 'var(--c-6b7079)' }}>{l.date}</div></div>
                    <div><div className="m" style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em' }}>{l.dep}</div><div className="m" style={{ fontSize: 10, color: 'var(--c-6b7079)' }}><b style={{ color: 'var(--c-111418)' }}>{l.from}</b></div></div>
                    <div style={{ textAlign: 'center' }}><div className="m" style={{ fontSize: 9.5, color: 'var(--c-6b7079)' }}>{l.dur}</div><div style={{ height: 1, background: 'var(--b-d7d9dd)', margin: '5px 0' }} /><div className="m" style={{ fontSize: 9.5, fontWeight: 700, color: l.stopColor }}>{l.stops}</div></div>
                    <div style={{ textAlign: 'right' }}><div className="m" style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.02em' }}>{l.arr}</div><div className="m" style={{ fontSize: 10, color: 'var(--c-6b7079)' }}><b style={{ color: 'var(--c-111418)' }}>{l.to}</b></div></div>
                  </div>
                ))}
                <div style={{ margin: '8px 16px 14px', display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid var(--l-dfe1e5)', borderRadius: 10, padding: '8px 8px 8px 12px' }}>
                  <div><div className="m" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-6b7079)' }}>BEST VALUE</div><div style={{ fontSize: 12.5, fontWeight: 700 }}>{f.best}</div></div>
                  <span className="m" style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 800 }}>{f.cpp}</span>
                  <span className={hot(f.key === 'ua' && s.press === 'compare')} style={{ padding: '9px 14px', borderRadius: 8, background: 'var(--b-14161a)', color: 'var(--c-fff)', fontSize: 12, fontWeight: 700 }}>Compare →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Chrome>
  );
}

// ── S3 Compare ────────────────────────────────────────────────────────────────
function CompareScreen() {
  const cell: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 160px 170px', alignItems: 'center' };
  return (
    <Chrome>
      <div style={{ height: 600, background: 'var(--b-5d6168)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, padding: '60px 40px', display: 'flex', flexDirection: 'column', gap: 14, opacity: .35 }}>
          <div style={{ height: 150, borderRadius: 14, background: 'var(--b-fff)' }} />
          <div style={{ height: 150, borderRadius: 14, background: 'var(--b-fff)' }} />
        </div>
        <div style={{ position: 'absolute', left: 150, right: 150, top: 24, background: 'var(--b-fff)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,.3)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 14px', borderBottom: '1px solid var(--l-ececea)' }}><span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--b-f2f3f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>×</span></div>
          <div style={{ padding: '14px 22px 16px', position: 'relative' }}>
            <div className="m" style={{ ...cell, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-4b5058)', padding: '0 16px 10px' }}><span>BOOKING OPTION</span><span>VALUE (CPP)</span><span /></div>
            <div style={{ ...cell, background: 'var(--b-e6f2e7)', border: '2px solid var(--l-b6d6ba)', padding: '14px 16px' }}>
              <div><div style={{ fontSize: 16, fontWeight: 700 }}>United MileagePlus via Chase</div><div style={{ fontSize: 12, color: 'var(--c-4b5058)', marginTop: 3 }}>1:1 transfer</div><span className="m" style={{ display: 'inline-block', marginTop: 6, padding: '2px 6px', background: 'var(--b-2e6b34)', color: 'var(--c-fff)', fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em' }}>BEST CHOICE</span><div className="m" style={{ fontSize: 10.5, color: 'var(--c-4b5058)', marginTop: 8 }}>Transfer from</div><span style={{ display: 'inline-block', marginTop: 4, padding: '3px 9px', border: '1px solid var(--l-c9ccd1)', borderRadius: 999, background: 'var(--b-fff)', fontSize: 11, fontWeight: 600 }}>Chase Sapphire Preferred <span className="m">1.3¢</span></span></div>
              <div><div className="m" style={{ fontSize: 30, fontWeight: 800 }}>1.3¢</div><div className="m" style={{ fontSize: 11, color: 'var(--c-4b5058)' }}>31,693 pts <span style={{ fontSize: 9 }}>est.</span></div><div className="m" style={{ fontSize: 10, color: 'var(--c-4b5058)' }}>Above face</div></div>
              <span style={{ padding: '12px 0', textAlign: 'center', borderRadius: 6, background: 'var(--b-2e7d32)', color: 'var(--c-fff)', fontSize: 13.5, fontWeight: 700 }}>View deal →</span>
            </div>
            <div style={{ ...cell, background: 'var(--b-f6f7f9)', padding: '14px 16px' }}>
              <div><div style={{ fontSize: 16, fontWeight: 700 }}>Chase Travel</div><div className="m" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--c-2563a6)', marginTop: 6 }}>DIRECT PORTAL</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-2e7d32)', marginTop: 4 }}>Pay $412 cash: earn 3× Chase Ultimate Rewards · est. 1,236 pts</div></div>
              <div><div className="m" style={{ fontSize: 30, fontWeight: 800 }}>1¢</div><div className="m" style={{ fontSize: 11, color: 'var(--c-4b5058)' }}>41,200 pts <span style={{ fontSize: 9 }}>est.</span></div><div className="m" style={{ fontSize: 10, color: 'var(--c-4b5058)' }}>= Cash</div></div>
              <span style={{ padding: '12px 0', textAlign: 'center', borderRadius: 6, background: 'var(--b-1b1c1f)', color: 'var(--c-fff)', fontSize: 13.5, fontWeight: 700 }}>View deal →</span>
            </div>
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '14px 16px', borderTop: '1px solid var(--l-ececea)', fontSize: 13, fontWeight: 700 }}><span style={{ display: 'flex' }}><i style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--b-1f6fbf)' }} /><i style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--b-c62828)', marginLeft: -5 }} /></span>See 2 round-trip options<span style={{ marginLeft: 'auto' }}>⌄</span></div>
            <div className="m" style={{ fontSize: 10, lineHeight: 1.55, color: 'var(--c-4b5058)', padding: '10px 16px 0', borderTop: '1px solid var(--l-ececea)' }}>Values compare each option against the current cash price. Transfer rows use simplified saver award rates; cash earnings assume the listed card&apos;s travel-category multiplier.</div>
          </div>
        </div>
      </div>
    </Chrome>
  );
}

// ── S4 Hotels + bonus banner ─────────────────────────────────────────────────
function HotelsScreen({ s }: { s: DeckState }) {
  const amenity = (t: string) => <span key={t} className="m" style={{ padding: '4px 7px', borderRadius: 4, background: 'var(--b-f2f3f5)', fontSize: 9.5, fontWeight: 700 }}>{t}</span>;
  const field: CSSProperties = { border: '1px solid var(--l-e6e7ea)', borderRadius: 9, padding: '7px 11px' };
  return (
    <div className="cv-pop" style={{ height: 600, background: 'var(--b-f2f3f5)', padding: '20px 24px' }}>
      <div style={{ display: 'flex', gap: 8, background: 'var(--b-fff)', border: '1px solid var(--l-e6e7ea)', borderRadius: 14, padding: 12 }}>
        <div style={{ flex: 2.4, ...field }}><div className="m" style={cap}>DESTINATION</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>Philadelphia, PA</div></div>
        <div style={{ flex: .8, ...field }}><div className="m" style={cap}>CHECK-IN</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>12/11/2026</div></div>
        <div style={{ flex: .8, ...field }}><div className="m" style={cap}>CHECK-OUT</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>12/14/2026</div></div>
        <div style={{ flex: 1.1, ...field }}><div className="m" style={cap}>GUESTS</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>2 adults · 1 room</div></div>
        <span style={{ display: 'flex', alignItems: 'center', padding: '0 22px', borderRadius: 9, background: 'var(--b-14161a)', color: 'var(--c-fff)', fontSize: 13, fontWeight: 700 }}>Search →</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '18px 0 10px' }}><span style={{ fontSize: 13, fontWeight: 800 }}>38 hotels in Philadelphia</span><span className="m" style={{ fontSize: 11, color: 'var(--c-4b5058)' }}>Dec 11 – Dec 14 · 3 nights</span></div>
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--l-e6e7ea)', background: 'var(--b-fff)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--b-fbefd9)', fontSize: 12.5, fontWeight: 600, color: 'var(--c-6b3a00)' }}>30% transfer bonus to World of Hyatt through Dec 31, 2026 · applies to the complete booking <span className="m" style={{ padding: '2px 6px', background: 'var(--b-f5a623)', color: 'var(--c-3a2000)', fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em' }}>LIMITED TIME</span></div>
        <div className={hot(s.press === 'hyatt')} style={{ display: 'flex', width: '100%', textAlign: 'left', borderTop: '1px solid var(--l-ececea)' }}>
          <div style={{ width: 160, height: 150, flex: 'none', background: 'linear-gradient(var(--b-cfd6de),var(--b-e6eaee))', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 40, bottom: 0, width: 70, height: 120, background: 'var(--b-eef1f4)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, padding: '12px 10px', alignContent: 'start' }}>
              {Array.from({ length: 9 }).map((_, i) => <i key={i} style={{ height: 10, background: 'var(--b-7d8b99)' }} />)}
            </div>
          </div>
          <div style={{ flex: 1, padding: '16px 18px' }}>
            <div style={{ color: 'var(--c-f5a623)', fontSize: 12 }}>★★★★<span style={{ color: 'var(--c-d7d9dd)' }}>★</span></div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', marginTop: 4 }}>Hyatt Centric Center City Philadelphia</div>
            <div style={{ fontSize: 12, color: 'var(--c-4b5058)', marginTop: 3 }}>1620 Chancellor St, Philadelphia</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>{['WI-FI', '24-HOUR FRONT DESK', 'GYM', 'RESTAURANT'].map(amenity)}</div>
          </div>
          <div style={{ padding: '16px 18px', textAlign: 'right' }}><div className="m" style={cap}>FROM</div><div style={{ fontSize: 22, fontWeight: 800 }}>$1,302</div><div style={{ fontSize: 11, color: 'var(--c-4b5058)' }}>$434/night</div></div>
        </div>
      </div>
      <div style={{ display: 'flex', marginTop: 12, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--l-e6e7ea)', background: 'var(--b-fff)' }}>
        <div style={{ width: 160, height: 120, flex: 'none', background: 'linear-gradient(var(--b-cdb9b1),var(--b-e9dcd6))' }} />
        <div style={{ flex: 1, padding: '16px 18px' }}><div style={{ color: 'var(--c-f5a623)', fontSize: 12 }}>★★★★<span style={{ color: 'var(--c-d7d9dd)' }}>★</span></div><div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', marginTop: 4 }}>Kimpton Hotel Palomar Philadelphia</div><div style={{ fontSize: 12, color: 'var(--c-4b5058)', marginTop: 3 }}>117 S 17th St, Philadelphia</div></div>
        <div style={{ padding: '16px 18px', textAlign: 'right' }}><div className="m" style={cap}>FROM</div><div style={{ fontSize: 22, fontWeight: 800 }}>$1,188</div><div style={{ fontSize: 11, color: 'var(--c-4b5058)' }}>$396/night</div></div>
      </div>
    </div>
  );
}

// ── S5 / S6 King room (bonus math + reports) ──────────────────────────────────
function RoomScreen({ s }: { s: DeckState }) {
  const t = Math.max(0, Math.min(1, (s.cpp - CPP_BASE) / (CPP_BONUS - CPP_BASE)));
  const cppTxt = (Math.round(s.cpp * 100) / 100).toFixed(2).replace(/0$/, '');
  const pts = fmt(ptsForCpp(s.cpp));
  const tier = s.cpp >= 2 ? 'Excellent' : 'Very good';
  const sub = s.bonusOn ? '1:1 transfer · 30% bonus applied' : '1:1 transfer';
  const col: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 190px 180px', alignItems: 'center' };
  void t;
  return (
    <Chrome>
      <div style={{ height: 600, background: 'var(--b-5d6168)', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 90, right: 90, top: s.reports ? '-170px' : '20px', background: 'var(--b-fff)', borderRadius: '14px 14px 0 0', boxShadow: '0 24px 60px rgba(0,0,0,.3)', padding: '18px 26px 30px', transition: 'top .5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div><div className="m" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-4b5058)' }}>POINTS VS CASH · 3 PORTALS</div><div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', marginTop: 4 }}>King Room</div><div style={{ fontSize: 13, color: 'var(--c-4b5058)', marginTop: 3 }}>1 King Bed · <b style={{ color: 'var(--c-111418)' }}>$1,302</b> cash · $434/night · 3 nights</div></div>
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--b-f2f3f5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</span>
          </div>
          <div className="m" style={{ marginTop: 14, padding: '10px 14px', background: 'var(--b-fbefd9)', color: 'var(--c-6b3a00)', fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, opacity: s.bonusOn ? 1 : .4 }}>⚡ 30% transfer bonus to World of Hyatt from Chase Ultimate Rewards through Dec 31, 2026 · applies to the complete booking</div>
          <div className="m" style={{ ...col, fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-4b5058)', padding: '12px 16px 8px' }}><span>BOOKING OPTION</span><span>VALUE (CPP)</span><span /></div>
          <div style={{ background: 'var(--b-e6f2e7)', padding: 16, position: 'relative', transition: 'transform .35s cubic-bezier(.2,.9,.3,1.15),box-shadow .35s', ...(s.spot ? { zIndex: 10, transform: 'scale(1.03)', boxShadow: '0 22px 50px rgba(0,0,0,.4)', borderRadius: 10 } : {}) }}>
            <div style={col}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700 }}>World of Hyatt via Chase <span className="m" style={{ padding: '2px 6px', background: 'var(--b-fbefd9)', color: 'var(--c-8a5300)', fontSize: 9.5, fontWeight: 800, display: s.bonusOn ? undefined : 'none' }}>+30% BONUS</span></div>
                <div style={{ fontSize: 12, color: 'var(--c-4b5058)', marginTop: 3 }}>{sub}</div>
                <div className="m" style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: 'var(--c-2e6b34)', marginTop: 7 }}>BEST CHOICE</div>
                <div className="m" style={{ fontSize: 10.5, color: 'var(--c-4b5058)', marginTop: 6 }}>Transfer from this card — it holds the live bonus</div>
                <span style={{ display: 'inline-block', marginTop: 5, padding: '3px 9px', border: '1.5px solid var(--l-6fb877)', borderRadius: 999, background: 'var(--b-fff)', fontSize: 11, fontWeight: 600, color: 'var(--c-2e6b34)' }}>Chase Sapphire Preferred <span className="m">{cppTxt}¢</span></span>
              </div>
              <div><span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 8, ...(s.bonusOn ? { background: 'var(--b-fff)', border: '1.5px solid var(--l-8fc796)' } : { border: '1.5px solid transparent' }) }}><span className="m" style={{ display: 'block', fontSize: 30, fontWeight: 800 }}>{cppTxt}¢</span><span className="m" style={{ display: 'block', fontSize: 11, color: 'var(--c-4b5058)' }}>{pts} pts <span style={{ fontSize: 9 }}>est.</span></span><span className="m" style={{ display: 'block', fontSize: 10, color: 'var(--c-4b5058)' }}>{tier}</span></span></div>
              <span style={{ padding: '13px 0', textAlign: 'center', borderRadius: 6, background: 'var(--b-2e7d32)', color: 'var(--c-fff)', fontSize: 14, fontWeight: 700 }}>View deal →</span>
            </div>
            <span className={`m ${hot(s.press === 'reports')}`} style={{ display: 'inline-block', marginTop: 10, padding: '6px 8px', marginLeft: -8, borderRadius: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--c-3b4048)' }}>{s.reports ? 'Hide 3 user reports ⌃' : 'See 3 user reports ⌄'}</span>
            {s.reports && (
              <div style={{ marginTop: 8, background: 'var(--b-fff)', border: '1px solid var(--l-dfe1e5)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', fontSize: 12.5, borderBottom: '1px solid var(--l-ececea)' }}><b>3 reports</b> · <b style={{ color: 'var(--c-2e7d32)', fontWeight: 600 }}>2 of 3 matched our quote</b> <span style={{ color: 'var(--c-4b5058)' }}>· seen $434–$451/night</span></div>
                <div className="m" style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1.2fr 1fr', padding: '9px 16px', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: 'var(--c-4b5058)', borderBottom: '1px solid var(--l-ececea)' }}><span>RESULT</span><span>CASH</span><span>POINTS</span><span>DATE(S)</span><span>REPORTED</span></div>
                {[['milesmaven', '3h ago'], ['hyattlife', '1d ago']].map(([who, ago]) => (
                  <div key={who} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1.2fr 1fr', alignItems: 'center', padding: '9px 16px', fontSize: 12.5, borderBottom: '1px solid var(--l-ececea)' }}><span className="m" style={{ justifySelf: 'start', padding: '3px 8px', borderRadius: 4, background: 'var(--b-e6f2e7)', color: 'var(--c-2e6b34)', fontSize: 9.5, fontWeight: 800 }}>MATCHED</span><span className="m">$434/night</span><span className="m">58,915 pts</span><span className="m">Dec 11 – Dec 14</span><span><b>{who}</b> <span style={{ color: 'var(--c-6b7079)', fontSize: 11 }}>{ago}</span></span></div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1.2fr 1fr', alignItems: 'center', padding: '9px 16px', fontSize: 12.5 }}><span className="m" style={{ justifySelf: 'start', padding: '3px 8px', borderRadius: 4, background: 'var(--b-fbefd9)', color: 'var(--c-8a5300)', fontSize: 9.5, fontWeight: 800 }}>DIFFERENT</span><span className="m">$451/night <b style={{ color: 'var(--c-b26a00)', fontSize: 10.5 }}>↑$17</b></span><span className="m">59,200 pts</span><span className="m" style={{ color: 'var(--c-b26a00)', fontWeight: 700 }}>Dec 12 – Dec 15</span><span><b>weekendflyer</b> <span style={{ color: 'var(--c-6b7079)', fontSize: 11 }}>2d ago</span></span></div>
              </div>
            )}
          </div>
          <div style={{ ...col, background: 'var(--b-f6f7f9)', padding: 16 }}>
            <div><div style={{ fontSize: 16, fontWeight: 700 }}>Chase Travel</div><div className="m" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--c-2563a6)', marginTop: 6 }}>DIRECT PORTAL</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-2e7d32)', marginTop: 4 }}>Pay $1,302 cash: earn 5× Chase Ultimate Rewards · est. 6,510 pts</div></div>
            <div><div className="m" style={{ fontSize: 30, fontWeight: 800, paddingLeft: 12 }}>1¢</div><div className="m" style={{ fontSize: 11, color: 'var(--c-4b5058)', paddingLeft: 12 }}>130,200 pts est.</div></div>
            <span style={{ padding: '13px 0', textAlign: 'center', borderRadius: 6, background: 'var(--b-1b1c1f)', color: 'var(--c-fff)', fontSize: 14, fontWeight: 700 }}>View deal →</span>
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, zIndex: 9, background: 'rgba(10,12,16,.62)', transition: 'opacity .35s', opacity: s.spot ? 1 : 0 }} />
      </div>
    </Chrome>
  );
}

// ── B1–B3 Board feed ──────────────────────────────────────────────────────────
function BoardScreen({ s }: { s: DeckState }) {
  const q = s.q.trim().toLowerCase();
  const list = BOARD_POSTS.filter((p) =>
    (!s.topic || p.topic === 'transfer') &&
    (!q || (p.title + ' ' + p.body + ' ' + (p.offer ? p.offer[2] : '')).toLowerCase().includes(q)));
  const savedCount = Object.keys(s.saved).filter((k) => s.saved[k]).length;
  const savedList = BOARD_POSTS.filter((p) => s.saved[p.id]);
  const chip = (txt: string, extra?: CSSProperties) => <span style={{ padding: '8px 12px', borderRadius: 999, background: 'var(--b-fff)', border: '1px solid var(--l-e6e6e2)', fontSize: 11.5, fontWeight: 700, ...extra }}>{txt}</span>;
  return (
    <Chrome>
      <div style={{ height: 600, background: 'var(--b-f4f4f1)', position: 'relative' }}>
        <div style={{ background: 'var(--b-f4f4f1)', minHeight: 1400, willChange: 'transform', transform: `translateY(${(-s.feedY).toFixed(1)}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, height: 48, padding: '0 24px', background: 'var(--b-fff)', borderBottom: '1px solid var(--l-e6e6e2)', fontSize: 12.5, fontWeight: 600 }}><span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.04em' }}>covelo<b style={{ color: 'var(--c-2d7a3a)' }}>.</b></span><span>Discover</span><span style={{ color: 'var(--c-4b5058)' }}>Offers</span><span style={{ color: 'var(--c-4b5058)' }}>Flights</span><span style={{ color: 'var(--c-4b5058)' }}>Hotels</span><span style={{ marginLeft: 'auto', width: 30, height: 30, borderRadius: '50%', background: 'var(--b-2d7a3a)', color: 'var(--c-fff)', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>SR</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 250px', gap: 20, padding: '18px 24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, paddingBottom: 12, borderBottom: '2px solid var(--l-111418)', position: 'relative' }}>
                <div style={{ flex: 1 }}><div className="m" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-4b5058)' }}>DISCOVER · COMMUNITY</div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.035em', marginTop: 4 }}>The board</div></div>
                <span className={hot(s.press === 'savedBtn')} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--b-fff)', fontSize: 12, fontWeight: 700, border: s.savedOpen ? '1.5px solid var(--l-111418)' : '1px solid var(--l-e6e6e2)' }}>Saved posts{savedCount ? <span className="m"> · {savedCount}</span> : null}</span>
                <span className={hot(s.press === 'newpost')} style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--b-14161a)', color: 'var(--c-fff)', fontSize: 12, fontWeight: 700 }}>+ New post</span>
                {s.savedOpen && (
                  <div className="cv-drop" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 380, background: 'var(--b-fff)', border: '1px solid var(--l-e6e6e2)', borderRadius: 12, boxShadow: '0 18px 40px rgba(0,0,0,.16)', zIndex: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--l-ececea)' }}><b style={{ fontSize: 13.5 }}>Saved posts</b><span className="m" style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: 'var(--c-4b5058)' }}>{savedCount} SAVED</span><span style={{ marginLeft: 'auto', color: 'var(--c-6b7079)' }}>×</span></div>
                    {savedList.map((p) => (
                      <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--l-ececea)' }}><b className="m" style={{ fontSize: 15, minWidth: 52 }}>{p.offer ? p.offer[0] : 'TIP'}</b><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.35 }}>{p.title}</div><div className="m" style={{ fontSize: 10, color: 'var(--c-6b7079)', marginTop: 3 }}>{p.meta}</div></div><span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-4b5058)' }}>Remove</span></div>
                    ))}
                    <div className="m" style={{ padding: '10px 16px', fontSize: 10, color: 'var(--c-6b7079)', background: 'var(--b-f8f8f6)' }}>EXPIRED OFFERS DROP OFF THIS LIST AUTOMATICALLY</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                {chip('Sort: Hot ⌄')}
                {chip('Show: All ⌄')}
                <span className={hot(s.press === 'topic')} style={{ padding: '8px 12px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: 'var(--b-fff)', border: s.topic ? '1.5px solid var(--l-111418)' : '1px solid var(--l-e6e6e2)' }}>Topic: {s.topic ? 'Transfer bonuses' : 'All topics'} ⌄</span>
                {chip('◌ Verified offers only', { fontWeight: 600, color: 'var(--c-4b5058)' })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, background: 'var(--b-fff)', border: '1px solid var(--l-e6e6e2)', borderRadius: 9, padding: '0 12px', height: 38 }}><span style={{ color: 'var(--c-6b7079)', fontSize: 13 }}>⌕</span><span style={{ flex: 1, fontSize: 12.5, color: s.q ? 'var(--c-111418)' : 'var(--c-6b7079)' }}>{s.q || 'Search tips and offers'}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {list.map((p) => {
                  const saved = !!s.saved[p.id];
                  return (
                    <div key={p.id} style={{ background: 'var(--b-fff)', borderRadius: 10, padding: '12px 16px 10px 8px', display: 'grid', gridTemplateColumns: '40px minmax(0,1fr)', gap: 6, border: '1px solid var(--l-e6e6e2)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, alignSelf: 'start', padding: '4px 0', borderRadius: 6, color: 'var(--c-111418)' }}><span style={{ fontSize: 12 }}>▲</span><b style={{ fontSize: 13 }}>{p.votes}</b><span style={{ fontSize: 10, color: 'var(--c-9a9ea5)' }}>▽</span></div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="m" style={{ padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 800, letterSpacing: '.06em', ...parseDyn(p.badgeDyn) }}>{p.badge}</span><span className="m" style={{ fontSize: 10.5, color: 'var(--c-4b5058)' }}>{p.meta}</span></div>
                        <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 6 }}>{p.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--c-4b5058)', lineHeight: 1.5, marginTop: 4 }}>{p.body}</div>
                        {p.offer && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 9, background: 'var(--b-f4f4f1)', border: '1px solid var(--l-e6e6e2)', borderRadius: 8, padding: '9px 12px' }}><b className="m" style={{ fontSize: 16, paddingRight: 12, borderRight: '1px solid var(--l-dcdcd6)' }}>{p.offer[0]}</b><div><div className="m" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.12em', color: 'var(--c-4b5058)' }}>{p.offer[1]}</div><div style={{ fontSize: 12, fontWeight: 700 }}>{p.offer[2]}</div></div><span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700 }}>View offer ›</span></div>
                        )}
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, fontWeight: 600, color: 'var(--c-4b5058)', alignItems: 'center' }}><span>◯ {p.comments} comments</span><span>⇪ Share</span><span className={p.id === 'p1' ? hot(s.press === 'save') : ''} style={{ padding: '4px 6px', borderRadius: 5, fontSize: 11, fontWeight: 700, ...(saved ? { color: 'var(--c-111418)', background: 'var(--b-ececea)' } : { color: 'var(--c-4b5058)' }) }}>{saved ? '■ Saved' : '□ Save'}</span></div>
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && <div style={{ padding: 26, textAlign: 'center', background: 'var(--b-fff)', borderRadius: 10, fontSize: 12.5, color: 'var(--c-4b5058)' }}>No posts match. Clear the search or topic.</div>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: 'var(--b-fff)', border: '1px solid var(--l-e6e6e2)', borderRadius: 10, padding: 14 }}><div className="m" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-4b5058)', paddingBottom: 9, borderBottom: '1px solid var(--l-ececea)' }}>OFFER VERIFICATION</div><span className="m" style={{ display: 'inline-block', marginTop: 10, padding: '2px 7px', borderRadius: 999, background: 'var(--b-dff0e2)', color: 'var(--c-2e6b34)', fontSize: 9, fontWeight: 800 }}>✓ VERIFIED BY ADMIN</span><div style={{ fontSize: 11, color: 'var(--c-4b5058)', lineHeight: 1.5, marginTop: 5 }}>An admin matched the post to a live covelo offer and confirmed terms and expiry.</div><span className="m" style={{ display: 'inline-block', marginTop: 10, padding: '2px 7px', borderRadius: 999, background: 'var(--b-fbefd9)', color: 'var(--c-8a5300)', fontSize: 9, fontWeight: 800 }}>◷ MEMBER OFFER</span><div style={{ fontSize: 11, color: 'var(--c-4b5058)', lineHeight: 1.5, marginTop: 5 }}>Posted by a member, not yet checked. Read the linked offer before acting.</div></div>
              <div style={{ background: 'var(--b-fff)', border: '1px solid var(--l-e6e6e2)', borderRadius: 10, padding: 14 }}><div className="m" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-4b5058)', paddingBottom: 9, borderBottom: '1px solid var(--l-ececea)' }}>BOARD RULES</div><div style={{ fontSize: 11, lineHeight: 1.5, marginTop: 8 }}><b className="m">01</b> Link a covelo offer, or create one for an admin to review.</div><div style={{ fontSize: 11, lineHeight: 1.5, marginTop: 5 }}><b className="m">02</b> No referral or affiliate links.</div><div style={{ fontSize: 11, lineHeight: 1.5, marginTop: 5 }}><b className="m">03</b> Say if a deal is dead and we&apos;ll archive it.</div></div>
            </div>
          </div>
        </div>
        {s.toast && <div style={{ position: 'absolute', left: '50%', bottom: 22, transform: 'translateX(-50%)', padding: '10px 16px', borderRadius: 8, background: 'var(--b-14161a)', color: 'var(--c-fff)', fontSize: 12.5, fontWeight: 700, boxShadow: '0 10px 24px rgba(0,0,0,.2)' }}>✓ Saved to your list</div>}
      </div>
    </Chrome>
  );
}

// Translate the data file's small inline-CSS badge strings into style objects.
function parseDyn(dyn: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const rule of dyn.split(';')) {
    const [k, v] = rule.split(':');
    if (!k || !v) continue;
    const key = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = v.trim();
  }
  return out as CSSProperties;
}

// ── B4 Composer ───────────────────────────────────────────────────────────────
function ComposerScreen({ s }: { s: DeckState }) {
  const bonusN = parseInt(s.bonus, 10) || 0;
  const ratio = bonusN > 0 ? (1 + bonusN / 100).toFixed(4) + ':1' : '–:1';
  const checks: Array<[boolean, string]> = [[true, 'Issuer selected'], [!!s.partner, 'Transfer partner selected'], [bonusN > 0, 'Bonus % or min points set']];
  const title = s.partner && bonusN ? `Chase → ${s.partner} ${bonusN}% transfer bonus` : 'What’s the deal, and who’s it for?';
  const postOff = !(s.partner && bonusN > 0);
  const lbl: CSSProperties = { fontSize: 8.5, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-4b5058)' };
  return (
    <Chrome>
      <div style={{ height: 600, background: 'var(--b-5d6168)', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 290, right: 290, top: 14, bottom: 14, background: 'var(--b-fff)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--l-ececea)' }}><b style={{ fontSize: 14.5 }}>New post</b><span style={{ marginLeft: 'auto', color: 'var(--c-6b7079)' }}>×</span></div>
          <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}><div style={{ border: '1px solid var(--l-e6e6e2)', borderRadius: 8, padding: '6px 10px' }}><b style={{ fontSize: 12 }}>Travel tip</b><div style={{ fontSize: 10.5, color: 'var(--c-6b7079)' }}>Advice, tricks, trip reports</div></div><div style={{ border: '1.5px solid var(--l-111418)', borderRadius: 8, padding: '6px 10px', background: 'var(--b-f2f2ef)' }}><b style={{ fontSize: 12 }}>Offer</b><div style={{ fontSize: 10.5, color: 'var(--c-6b7079)' }}>Share a deal from covelo</div></div></div>
            <div style={{ display: 'flex', alignItems: 'center' }}><span className="m" style={lbl}>OFFER</span><span style={{ marginLeft: 'auto', display: 'flex', borderRadius: 8, background: 'var(--b-f2f2ef)', padding: 3, fontSize: 11, fontWeight: 700 }}><span style={{ padding: '6px 10px', color: 'var(--c-4b5058)' }}>Link a covelo offer</span><span style={{ padding: '6px 10px', background: 'var(--b-fff)', borderRadius: 6 }}>Create new offer</span></span></div>
            <div style={{ background: 'var(--b-f4f4f1)', border: '1px solid var(--l-e6e6e2)', borderRadius: 10, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', gap: 4 }}><span style={{ padding: '6px 10px', borderRadius: 7, background: 'var(--b-14161a)', color: 'var(--c-fff)', fontSize: 11, fontWeight: 700 }}>Transfer Bonus</span><span style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--c-4b5058)' }}>Spending Bonus</span></div>
              <div className="m" style={lbl}>1 · ISSUER &amp; PARTNER</div>
              <div><div className="m" style={lbl}>ISSUER</div><div style={{ marginTop: 3, background: 'var(--b-fff)', border: '1px solid var(--l-e6e6e2)', borderRadius: 7, padding: '6px 10px', fontSize: 12 }}>Chase</div></div>
              <div><span className="m" style={lbl}>TRANSFER PARTNER</span><div className={hot(s.press === 'partner')} style={{ marginTop: 3, background: 'var(--b-fff)', border: '1px solid var(--l-e6e6e2)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: s.partner ? 'var(--c-111418)' : 'var(--c-9a9ea5)' }}>{s.partner || 'Select partner…'}</div></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><span className="m" style={lbl}>BONUS %</span><div style={{ marginTop: 3, background: 'var(--b-fff)', border: '1px solid var(--l-e6e6e2)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: s.bonus ? 'var(--c-111418)' : 'var(--c-9a9ea5)' }}>{s.bonus || 'e.g. 30'}</div></div>
                <div><span className="m" style={lbl}>EFFECTIVE RATIO</span><div className="m" style={{ marginTop: 3, background: 'var(--b-fff)', borderRadius: 7, padding: '7px 10px', fontSize: 12, ...(bonusN > 0 ? { border: '1.5px solid var(--l-2e7d32)', color: 'var(--c-111418)' } : { border: '1px solid var(--l-e6e6e2)', color: 'var(--c-9a9ea5)' }) }}>{ratio}</div></div>
              </div>
              <div style={{ borderTop: '1px solid var(--l-e6e6e2)', paddingTop: 5 }}><div className="m" style={lbl}>VALIDATION</div>
                {checks.map(([ok, label]) => <div key={label} style={{ fontSize: 11, marginTop: 2, color: ok ? 'var(--c-111418)' : 'var(--c-b3261e)' }}>{ok ? '✓' : '×'} {label}</div>)}
              </div>
            </div>
            <div><div className="m" style={lbl}>TITLE</div><div style={{ marginTop: 3, border: '1px solid var(--l-e6e6e2)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: s.partner && bonusN ? 'var(--c-111418)' : 'var(--c-9a9ea5)' }}>{title}</div></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--l-ececea)' }}><span className="m" style={{ fontSize: 10, color: 'var(--c-6b7079)' }}>2 posts left today</span><span style={{ marginLeft: 'auto', padding: '8px 14px', border: '1px solid var(--l-e6e6e2)', borderRadius: 7, fontSize: 12, fontWeight: 700 }}>Cancel</span><span className={hot(s.press === 'post')} style={{ padding: '8px 16px', borderRadius: 7, color: 'var(--c-fff)', fontSize: 12, fontWeight: 700, background: postOff ? 'var(--b-b9bcc2)' : 'var(--b-14161a)' }}>Post</span></div>
        </div>
      </div>
    </Chrome>
  );
}

// ── T1 Trip planner placeholder ───────────────────────────────────────────────
function TripScreen() {
  return (
    <Chrome>
      <div style={{ height: 600, background: 'var(--b-f2f3f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: '100%', height: '100%', border: '2px dashed var(--l-b9bcc2)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center' }}>
          <div className="m" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: 'var(--c-4b5058)' }}>PLACEHOLDER</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>Trip planner slides go here</div>
          <div style={{ fontSize: 14, color: 'var(--c-4b5058)', maxWidth: 460, lineHeight: 1.5 }}>Itinerary by day, map pins, Add to trip and saved trips. Built the same way once there&apos;s a recording to work from.</div>
        </div>
      </div>
    </Chrome>
  );
}

export function StageScreens({ state, id }: { state: DeckState; id: string }) {
  switch (id) {
    case 's1': return <SearchScreen s={state} />;
    case 's2': return <ResultsScreen s={state} />;
    case 's3': return <CompareScreen />;
    case 's4': return <HotelsScreen s={state} />;
    case 's5':
    case 's6': return <RoomScreen s={state} />;
    case 'b1':
    case 'b2':
    case 'b3': return <BoardScreen s={state} />;
    case 'b4': return <ComposerScreen s={state} />;
    case 't1': return <TripScreen />;
    default: return null;
  }
}
