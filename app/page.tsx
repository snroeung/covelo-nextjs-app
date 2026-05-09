"use client";

import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ACTIVE_PALETTE, getTokens, type Tokens } from "@/lib/themes";

// ── Theme hook ───────────────────────────────────────────────────────────────
// Observes data-theme on <html> so the entire page re-renders on toggle.
function useHcTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.getAttribute("data-theme") === "dark");
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return mobile;
}

// ── Primitives (ported from covelo-primitives.jsx) ───────────────────────────

type IconName =
  | "pin" | "cal" | "moon" | "sun" | "search" | "user" | "plus" | "minus"
  | "chev-l" | "chev-r" | "chev-d" | "plane" | "bed" | "map" | "route" | "list"
  | "heart" | "dots" | "x" | "star" | "star-o" | "check" | "arrow-r" | "filter"
  | "card" | "wifi" | "coffee" | "menu" | "sparkle" | "globe" | "bolt" | "notes";

function Icon({ name, size = 16, stroke = 1.5, color = "currentColor", style }: {
  name: IconName; size?: number; stroke?: number; color?: string; style?: React.CSSProperties;
}) {
  const s: React.CSSProperties = {
    width: size, height: size, stroke: color, strokeWidth: stroke,
    fill: "none", strokeLinecap: "round", strokeLinejoin: "round", ...(style || {}),
  };
  switch (name) {
    case "search":  return <svg viewBox="0 0 24 24" style={s}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case "chev-l":  return <svg viewBox="0 0 24 24" style={s}><path d="m15 6-6 6 6 6"/></svg>;
    case "chev-r":  return <svg viewBox="0 0 24 24" style={s}><path d="m9 6 6 6-6 6"/></svg>;
    case "chev-d":  return <svg viewBox="0 0 24 24" style={s}><path d="m6 9 6 6 6-6"/></svg>;
    case "plus":    return <svg viewBox="0 0 24 24" style={s}><path d="M12 5v14M5 12h14"/></svg>;
    case "minus":   return <svg viewBox="0 0 24 24" style={s}><path d="M5 12h14"/></svg>;
    case "check":   return <svg viewBox="0 0 24 24" style={s}><path d="m5 12 5 5 9-11"/></svg>;
    case "x":       return <svg viewBox="0 0 24 24" style={s}><path d="m6 6 12 12M18 6 6 18"/></svg>;
    case "arrow-r": return <svg viewBox="0 0 24 24" style={s}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "sparkle": return <svg viewBox="0 0 24 24" style={s}><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></svg>;
    case "filter":  return <svg viewBox="0 0 24 24" style={s}><path d="M3 5h18M6 12h12M10 19h4"/></svg>;
    case "bolt":    return <svg viewBox="0 0 24 24" style={s}><path d="m13 3-8 11h6l-1 7 8-11h-6l1-7Z"/></svg>;
    case "heart":   return <svg viewBox="0 0 24 24" style={s}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>;
    case "dots":    return <svg viewBox="0 0 24 24" style={s}><circle cx="5" cy="12" r="1.2" fill={color}/><circle cx="12" cy="12" r="1.2" fill={color}/><circle cx="19" cy="12" r="1.2" fill={color}/></svg>;
    case "star":    return <svg viewBox="0 0 24 24" style={{ ...s, fill: color }}><path d="m12 3 2.8 6 6.2.8-4.5 4.3 1.2 6.2L12 17.8 6.3 20.3l1.2-6.2L3 9.8 9.2 9 12 3Z"/></svg>;
    case "star-o":  return <svg viewBox="0 0 24 24" style={s}><path d="m12 3 2.8 6 6.2.8-4.5 4.3 1.2 6.2L12 17.8 6.3 20.3l1.2-6.2L3 9.8 9.2 9 12 3Z"/></svg>;
    case "menu":    return <svg viewBox="0 0 24 24" style={s}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
    default:        return <svg viewBox="0 0 24 24" style={s}/>;
  }
}

// Map tile — SVG roads + labels (styled by dark/light)
function MapTile({ dark, accent, style }: { dark: boolean; accent: string; style?: React.CSSProperties }) {
  const p = dark
    ? { land: "#1a2434", water: "#0f1824", road: "#2a3850", majorRoad: "#3a4a66", park: "#1e3028", label: "#6b7a92" }
    : { land: "#eef3f8", water: "#c9dcec", road: "#ffffff",  majorRoad: "#fde2a4", park: "#dce8d0", label: "#64748b" };
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice"
      style={{ width: "100%", height: "100%", display: "block", ...(style || {}) }}>
      <rect width="400" height="500" fill={p.land}/>
      <path d="M-20 380 Q 80 360 160 400 T 420 430 L 420 500 L -20 500 Z" fill={p.water}/>
      <path d="M350 -20 Q 360 80 330 160 Q 300 240 360 340 L 420 340 L 420 -20 Z" fill={p.water}/>
      <rect x="50"  y="60"  width="70" height="55" rx="3" fill={p.park}/>
      <rect x="260" y="280" width="60" height="50" rx="3" fill={p.park}/>
      <path d="M-20 180 L 420 160" stroke={p.majorRoad} strokeWidth="10"/>
      <path d="M-20 180 L 420 160" stroke={dark ? "#fbbf24" : "#f59e0b"} strokeWidth="2" opacity="0.5" strokeDasharray="6 6"/>
      {[80,130,200,250,300].map((y,i) => <line key={"h"+i} x1="-10" y1={y} x2="410" y2={y} stroke={p.road} strokeWidth={i===2?3:1.5}/>)}
      {[50,110,170,230,290,350].map((x,i) => <line key={"v"+i} x1={x} y1="-10" x2={x} y2="510" stroke={p.road} strokeWidth={i===3?3:1.5}/>)}
      {[[60,190,40,50],[115,200,50,45],[180,195,45,50],[240,205,45,40],[310,200,35,45]].map((b,i) => (
        <rect key={"b"+i} x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill={dark?"#223049":"#e2eaf2"} opacity="0.6"/>
      ))}
      <g fill={p.label} fontFamily="Inter, sans-serif" fontSize="8" fontWeight="500">
        <text x="70"  y="90"  opacity="0.8">LOGAN SQUARE</text>
        <text x="270" y="305" opacity="0.8">CHINATOWN</text>
        <text x="180" y="340" opacity="0.8">RITTENHOUSE</text>
        <text x="60"  y="420" opacity="0.6">SCHUYLKILL</text>
      </g>
      <g>
        <circle cx="170" cy="220" r="10" fill={accent} opacity="0.15"/>
        <circle cx="170" cy="220" r="5"  fill={accent} stroke="#fff" strokeWidth="2"/>
        <circle cx="245" cy="195" r="10" fill={accent} opacity="0.15"/>
        <circle cx="245" cy="195" r="5"  fill={accent} stroke="#fff" strokeWidth="2"/>
        <circle cx="210" cy="270" r="10" fill={accent} opacity="0.15"/>
        <circle cx="210" cy="270" r="5"  fill={accent} stroke="#fff" strokeWidth="2"/>
      </g>
    </svg>
  );
}

// Photo placeholder — gradient stripes
function PhotoHero({ tone = "cool", label = "", radius = 12, style }: {
  tone?: string; label?: string; radius?: number; style?: React.CSSProperties;
}) {
  const tones: Record<string, [string, string]> = {
    cool:  ["#3b6aa0", "#6f92bd"], warm: ["#b88756", "#d2a97a"],
    green: ["#5a8a6b", "#84ab8f"], slate: ["#49586e", "#7887a0"],
    night: ["#1e2a42", "#3b4a66"], sand: ["#c3a97a", "#e0c9a1"],
  };
  const [c1, c2] = tones[tone] || tones.cool;
  const id = `ph-${tone}`;
  return (
    <div style={{ position: "relative", borderRadius: radius, overflow: "hidden",
      background: `linear-gradient(135deg, ${c1}, ${c2})`, ...(style || {}) }}>
      <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,0.06)" strokeWidth="2"/>
          </pattern>
        </defs>
        <rect width="100" height="60" fill={`url(#${id})`}/>
      </svg>
      {label && (
        <div style={{ position: "absolute", left: 8, bottom: 6,
          fontFamily: "Geist Mono, ui-monospace, monospace", fontSize: 9,
          color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em" }}>
          {label}
        </div>
      )}
    </div>
  );
}

function PhotoThumb({ tone = "cool", w = 56, h = 56, radius = 8, style }: {
  tone?: string; w?: number; h?: number; radius?: number; style?: React.CSSProperties;
}) {
  const tones: Record<string, [string, string]> = {
    cool:  ["#3b6aa0", "#6f92bd"], warm: ["#b88756", "#d2a97a"],
    green: ["#5a8a6b", "#84ab8f"], slate: ["#49586e", "#7887a0"],
  };
  const [c1, c2] = tones[tone] || tones.cool;
  const id = `pt-${tone}-${w}`;
  return (
    <div style={{ width: w, height: h, borderRadius: radius, overflow: "hidden", flexShrink: 0, ...(style || {}) }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c1}/><stop offset="1" stopColor={c2}/>
          </linearGradient>
          <pattern id={id+"s"} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <rect width="6" height="6" fill={`url(#${id})`}/>
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.08)" strokeWidth="2"/>
          </pattern>
        </defs>
        <rect width={w} height={h} fill={`url(#${id}s)`}/>
      </svg>
    </div>
  );
}

// covelo. wordmark
function Wordmark({ color = "#0c0c0d", size = 18, style }: {
  color?: string; size?: number; style?: React.CSSProperties;
}) {
  return (
    <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: size,
      letterSpacing: "-0.03em", color, ...(style || {}) }}>
      covelo<span style={{ opacity: 0.55 }}>.</span>
    </span>
  );
}

// ── Screen-cap: Hotels ───────────────────────────────────────────────────────

function ScreenCapHotels({ t, dark }: { t: Tokens; dark: boolean }) {
  const { ink, muted, line, card, bg } = t;
  const Search = ({ label, value }: { label: string; value: string }) => (
    <div style={{ background: bg, border: `1px solid ${line}`, borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 8, fontFamily: t.mono, color: muted, letterSpacing: "0.08em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11, color: ink, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
  return (
    <div style={{ background: card, borderRadius: 10, overflow: "hidden", border: `1px solid ${line}` }}>
      {/* ribbon */}
      <div style={{ background: t.navy, color: dark ? muted : "#cfcfcc", fontSize: 8.5, padding: "4px 18px",
        display: "flex", justifyContent: "space-between", fontFamily: t.mono, letterSpacing: "0.06em" }}>
        <span>COVELO · POINTS ENGINE + TRAVEL PLANNER</span>
        <span>USD · 5 CARDS · 487,320 PTS</span>
      </div>
      {/* nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 18px", background: card, borderBottom: `1px solid ${line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Wordmark color={ink} size={14}/>
          <div style={{ display: "flex", gap: 3 }}>
            {(["Flights", "Hotels", "Trip Planner"] as const).map((l) => {
              const a = l === "Hotels";
              return <span key={l} style={{ padding: "5px 10px", borderRadius: 4, fontSize: 10,
                fontWeight: a ? 700 : 600, color: a ? t.sky : muted,
                background: a ? ink : "transparent" }}>{l}</span>;
            })}
          </div>
        </div>
        <span style={{ padding: "4px 8px", background: bg, border: `1px solid ${line}`, borderRadius: 4,
          fontSize: 9, color: muted, fontWeight: 600 }}>✦ Ask covelo AI</span>
      </div>
      {/* search row */}
      <div style={{ padding: "10px 18px", borderBottom: `1px solid ${line}`,
        display: "grid", gridTemplateColumns: "1.6fr 100px 100px 70px 80px auto", gap: 6 }}>
        <Search label="LOCATION" value="Philadelphia"/>
        <Search label="CHECK-IN"  value="Apr 27"/>
        <Search label="CHECK-OUT" value="Apr 30"/>
        <Search label="ROOMS"     value="1"/>
        <Search label="GUESTS"    value="2"/>
        <button style={{ background: ink, color: dark ? "#0a0a0a" : "#fff", border: "none",
          borderRadius: 6, padding: "0 18px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
          Search →
        </button>
      </div>
      {/* body */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr" }}>
        {/* card rail */}
        <aside style={{ borderRight: `1px solid ${line}`, padding: "16px 14px" }}>
          <div style={{ fontSize: 12, color: ink, fontWeight: 800, marginBottom: 10 }}>Your cards</div>
          {([["CHASE", ["Sapphire Reserve","Sapphire Pref"]],["AMEX",["Platinum","Gold"]],
             ["CAPITAL ONE",["Venture X","Venture"]]] as [string, string[]][]).map(([issuer, cards], gi) => (
            <div key={issuer} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 8, letterSpacing: "0.1em", color: muted, marginBottom: 5,
                fontFamily: t.mono, fontWeight: 700 }}>{issuer}</div>
              {cards.map((c, i) => {
                const sel = i === 1 || (gi === 0 && i === 0);
                return (
                  <div key={c} style={{ padding: "5px 8px",
                    border: `1px solid ${sel ? t.blue : line}`,
                    background: sel ? t.blueSoft : "transparent", color: sel ? t.blue : ink,
                    borderRadius: 4, fontSize: 10, fontWeight: sel ? 700 : 500, marginBottom: 3 }}>{c}</div>
                );
              })}
            </div>
          ))}
          <div style={{ marginTop: 10, padding: 10, background: bg, borderRadius: 6, border: `1px solid ${line}` }}>
            <div style={{ fontSize: 8, fontFamily: t.mono, color: muted, fontWeight: 700, letterSpacing: "0.08em" }}>BALANCE</div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: ink, fontFamily: t.mono }}>487,320</div>
            <div style={{ fontSize: 9, color: muted }}>5 cards · ~$6,100</div>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
              {([["Bilt","104,134",t.blue],["Amex MR","184,500",t.sky],["Chase UR","120,800",t.good]] as [string,string,string][]).map(([n,v,c]) => (
                <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 9 }}>
                  <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <span style={{ width: 5, height: 5, background: c }}/>
                    <span style={{ color: ink, fontWeight: 600 }}>{n}</span>
                  </span>
                  <span style={{ fontFamily: t.mono, color: muted, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
        {/* results */}
        <main style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8,
            borderBottom: `1.5px solid ${ink}`, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, color: ink, fontWeight: 800, letterSpacing: "-0.02em" }}>
                42 hotels in Philadelphia
              </div>
              <div style={{ fontSize: 9, color: muted, fontFamily: t.mono, letterSpacing: "0.04em", marginTop: 2 }}>
                1 ROOM · 2 GUESTS · 8 PORTALS
              </div>
            </div>
            <div style={{ fontSize: 9, color: muted, fontWeight: 600 }}>Sort: Best value ▾</div>
          </div>
          {[
            { n: "Hyatt Centric Rittenhouse Sq", price: "$1,302", night: "$434", pts: "104,134", cpp: "1.25¢", best: true,  tone: "cool" },
            { n: "Element Philadelphia Downtown",  price: "$1,049", night: "$350", pts: "83,920",  cpp: "1.25¢", best: false, tone: "slate" },
          ].map((r, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: i === 0 ? `1px solid ${line}` : "none",
              display: "grid", gridTemplateColumns: "100px 1fr", gap: 12 }}>
              <div style={{ position: "relative", height: 92, borderRadius: 4, overflow: "hidden" }}>
                <PhotoHero tone={r.tone} label="" radius={4} style={{ height: 92 }}/>
                {r.best && (
                  <div style={{ position: "absolute", top: 5, left: 5, padding: "2px 6px",
                    background: ink, color: dark ? "#0a0a0a" : "#fff", borderRadius: 2,
                    fontSize: 7, fontFamily: t.mono, fontWeight: 700, letterSpacing: "0.06em" }}>
                    ★ BEST VALUE
                  </div>
                )}
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, color: ink, fontWeight: 800, letterSpacing: "-0.01em" }}>{r.n}</div>
                    <div style={{ fontSize: 9, color: muted, marginTop: 2 }}>1620 Chancellor St · 3 nights</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 8, color: muted, fontFamily: t.mono, fontWeight: 700, letterSpacing: "0.08em" }}>FROM · CASH</div>
                    <div style={{ fontSize: 18, color: ink, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>{r.price}</div>
                    <div style={{ fontSize: 9, color: muted }}>{r.night}/night</div>
                  </div>
                </div>
                {/* points panel */}
                <div style={{ marginTop: 8, background: dark ? t.blueSoft : "#0c0c0d", borderRadius: 5,
                  padding: "8px 11px", display: "grid", gridTemplateColumns: "auto 1fr auto",
                  gap: 12, color: dark ? ink : "#fff", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 7.5, letterSpacing: "0.1em",
                      color: dark ? muted : "#a0a0a0", fontFamily: t.mono, fontWeight: 700 }}>BEST PORTAL</div>
                    <div style={{ fontSize: 10, fontWeight: 700, marginTop: 1 }}>Bilt Travel</div>
                  </div>
                  <div style={{ fontFamily: t.mono, fontSize: 13, color: t.sky, fontWeight: 700, textAlign: "right" }}>
                    {r.pts}<span style={{ fontSize: 9, color: dark ? muted : "#a0a0a0", marginLeft: 4 }}>pts</span>
                  </div>
                  <div style={{ padding: "4px 8px", background: t.sky, color: "#000",
                    borderRadius: 3, fontSize: 9, fontWeight: 800, fontFamily: t.mono }}>
                    {r.cpp}/PT
                  </div>
                </div>
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}

// ── Screen-cap: Trip Planner ─────────────────────────────────────────────────

function ScreenCapTrip({ t, dark }: { t: Tokens; dark: boolean }) {
  const { ink, muted, line, card, bg } = t;
  return (
    <div style={{ background: card, borderRadius: 10, overflow: "hidden", border: `1px solid ${line}` }}>
      <div style={{ background: t.navy, color: dark ? muted : "#cfcfcc", fontSize: 8.5,
        padding: "4px 18px", display: "flex", justifyContent: "space-between",
        fontFamily: t.mono, letterSpacing: "0.06em" }}>
        <span>COVELO · TRIP PLANNER</span><span>PHILADELPHIA · APR 27—30</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 18px", borderBottom: `1px solid ${line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Wordmark color={ink} size={14}/>
          <div style={{ display: "flex", gap: 3 }}>
            {(["Flights","Hotels","Trip Planner"] as const).map((l) => {
              const a = l === "Trip Planner";
              return <span key={l} style={{ padding: "5px 10px", borderRadius: 4, fontSize: 10,
                fontWeight: a ? 700 : 600, color: a ? t.sky : muted, background: a ? ink : "transparent" }}>{l}</span>;
            })}
          </div>
        </div>
        <span style={{ padding: "4px 10px", background: t.sky, color: "#000",
          borderRadius: 4, fontSize: 9, fontWeight: 800, fontFamily: t.mono }}>+ NEW TRIP</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 200px", height: 320 }}>
        {/* day rail */}
        <aside style={{ borderRight: `1px solid ${line}`, padding: "14px 12px" }}>
          <div style={{ fontSize: 9, fontFamily: t.mono, color: muted, fontWeight: 700,
            letterSpacing: "0.08em", marginBottom: 8 }}>3 DAYS</div>
          {[
            { d: "MON", n: "27", l: "Arrival", active: true },
            { d: "TUE", n: "28", l: "Old City" },
            { d: "WED", n: "29", l: "Fairmount" },
          ].map((day) => (
            <div key={day.n} style={{ padding: "8px 10px", borderRadius: 5, marginBottom: 4,
              background: day.active ? t.blueSoft : "transparent",
              border: `1px solid ${day.active ? t.blue : "transparent"}`,
              display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ fontSize: 8, fontFamily: t.mono, color: muted, fontWeight: 700 }}>{day.d}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: day.active ? t.blue : ink,
                letterSpacing: "-0.02em", lineHeight: 1 }}>{day.n}</div>
              <div style={{ fontSize: 10, color: day.active ? t.blue : muted, fontWeight: 600 }}>{day.l}</div>
            </div>
          ))}
        </aside>
        {/* map */}
        <div style={{ position: "relative", overflow: "hidden" }}>
          <MapTile dark={dark} accent={t.sky} style={{ height: "100%" }}/>
          {([[40,30,"1"],[60,55,"2"],[35,70,"3"],[70,35,"4"]] as [number,number,string][]).map(([x,y,n],i) => (
            <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`,
              width: 22, height: 22, borderRadius: 22, background: t.sky, border: "2px solid #000",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#000", fontFamily: t.mono,
              transform: "translate(-50%,-50%)", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>{n}</div>
          ))}
        </div>
        {/* itinerary */}
        <aside style={{ borderLeft: `1px solid ${line}`, padding: "14px 12px", background: bg }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: ink, marginBottom: 8 }}>Mon, Apr 27</div>
          {[
            { t: "10:42", n: "AMTRAK NER",    k: "Train" },
            { t: "12:30", n: "Hyatt Centric", k: "Check-in" },
            { t: "15:00", n: "Reading Terminal", k: "Lunch" },
            { t: "19:00", n: "Zahav",          k: "Dinner" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, paddingBottom: 8, marginBottom: 8,
              borderBottom: i < 3 ? `1px solid ${line}` : "none" }}>
              <div style={{ fontSize: 9, fontFamily: t.mono, color: muted, fontWeight: 700, width: 28 }}>{s.t}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: ink }}>{s.n}</div>
                <div style={{ fontSize: 8, color: muted, fontFamily: t.mono, letterSpacing: "0.06em", fontWeight: 600 }}>
                  {s.k.toUpperCase()}
                </div>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

// ── Screen-cap: Flights ──────────────────────────────────────────────────────

function ScreenCapFlights({ t, dark }: { t: Tokens; dark: boolean }) {
  const { ink, muted, line, card, bg } = t;
  const flights = [
    { air: "UNITED",   code: "UA 1762", from: "07:15", to: "10:38", dur: "6h 23m", stop: "Nonstop",    price: "$386", pts: "32,166", cpp: "1.20¢", best: true },
    { air: "AMERICAN", code: "AA 285",  from: "11:45", to: "16:12", dur: "7h 27m", stop: "1 stop · ORD",price: "$418", pts: "27,866", cpp: "1.50¢", best: false },
  ];
  return (
    <div style={{ background: card, borderRadius: 10, overflow: "hidden", border: `1px solid ${line}` }}>
      <div style={{ background: t.navy, color: dark ? muted : "#cfcfcc", fontSize: 8.5,
        padding: "4px 18px", display: "flex", justifyContent: "space-between",
        fontFamily: t.mono, letterSpacing: "0.06em" }}>
        <span>COVELO · FLIGHTS</span><span>PHL → SFO · ROUND TRIP</span>
      </div>
      <div style={{ padding: "10px 18px", borderBottom: `1px solid ${line}`,
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Wordmark color={ink} size={14}/>
          <div style={{ display: "flex", gap: 3 }}>
            {(["Flights","Hotels","Trip Planner"] as const).map((l) => {
              const a = l === "Flights";
              return <span key={l} style={{ padding: "5px 10px", borderRadius: 4, fontSize: 10,
                fontWeight: a ? 700 : 600, color: a ? t.sky : muted, background: a ? ink : "transparent" }}>{l}</span>;
            })}
          </div>
        </div>
        <span style={{ fontSize: 9, fontFamily: t.mono, color: muted, fontWeight: 700, letterSpacing: "0.08em" }}>
          SORT · CHEAPEST + BEST PT VALUE
        </span>
      </div>
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: ink, letterSpacing: "-0.02em" }}>112 flights · PHL → SFO</div>
          <div style={{ fontSize: 9, color: muted, fontWeight: 600 }}>April 27 · 1 adult</div>
        </div>
        {flights.map((f, i) => (
          <div key={i} style={{ padding: "12px 14px",
            border: `1px solid ${f.best ? t.blue : line}`,
            background: f.best ? t.blueSoft : "transparent",
            borderRadius: 7, marginBottom: 6,
            display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 14, alignItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: 4, background: ink, color: dark ? "#0a0a0a" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, fontFamily: t.mono }}>{f.air[0]}</div>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: ink, fontFamily: t.mono, letterSpacing: "-0.01em" }}>{f.from}</span>
                <span style={{ fontSize: 9, color: muted, fontFamily: t.mono }}>──────</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: ink, fontFamily: t.mono, letterSpacing: "-0.01em" }}>{f.to}</span>
                <span style={{ fontSize: 9, color: muted, fontFamily: t.mono, fontWeight: 700, marginLeft: 8 }}>{f.dur}</span>
              </div>
              <div style={{ fontSize: 9, color: muted, marginTop: 2, fontFamily: t.mono, fontWeight: 600, letterSpacing: "0.04em" }}>
                {f.code} · {f.stop}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: ink, letterSpacing: "-0.02em", lineHeight: 1 }}>{f.price}</div>
              <div style={{ fontSize: 9, color: muted, marginTop: 2, fontFamily: t.mono }}>{f.pts} pts</div>
            </div>
            <div style={{ padding: "5px 9px",
              background: f.best ? t.blue : bg, color: f.best ? (dark ? "#0a0a0a" : "#fff") : ink,
              border: `1px solid ${f.best ? t.blue : line}`,
              borderRadius: 4, fontSize: 9, fontWeight: 800, fontFamily: t.mono }}>
              {f.cpp}/PT
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mobile screen-cap shell ──────────────────────────────────────────────────

function MobileShell({ t, children }: { t: Tokens; children: React.ReactNode }) {
  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: t.sans,
      border: `1px solid ${t.line}`, borderRadius: 10, overflow: "hidden" }}>
      {children}
    </div>
  );
}

// ── Mobile: Hotels ────────────────────────────────────────────────────────────

function ScreenCapHotelsMobile({ t, dark }: { t: Tokens; dark: boolean }) {
  const hotels = [
    { n: "Hyatt Centric Rittenhouse Sq.", sub: "1620 Chancellor · 3 nights", price: 1302, night: 434, tone: "cool" as const, pts: "104,134", cpp: "1.25¢", best: true },
    { n: "Element Philadelphia Downtown",  sub: "1441 Chestnut · 3 nights",  price: 1049, night: 350, tone: "slate" as const, pts: "83,920",  cpp: "1.25¢", best: false },
  ];
  const inkFg = dark ? "#0a0a0a" : "#fff";
  return (
    <MobileShell t={t}>
      {/* Hero */}
      <div style={{ padding: "16px 20px", background: t.card, borderBottom: `1px solid ${t.line}` }}>
        <div style={{ fontSize: 10, letterSpacing: "0.12em", color: t.muted, marginBottom: 6,
          fontFamily: t.mono, fontWeight: 700 }}>HOTELS · PHILADELPHIA</div>
        <div style={{ fontSize: 34, lineHeight: 1.05, color: t.ink, letterSpacing: "-0.03em", fontWeight: 800 }}>
          42 stays<span style={{ color: t.sky }}>.</span>
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 4, fontFamily: t.mono }}>
          APR 27 → APR 30 · 1 ROOM · 2 GUESTS
        </div>
      </div>
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6, padding: "12px 20px", overflowX: "auto" }}>
        {([["All cards", true], ["Bilt", false], ["Sapphire P.", false], ["Amex Gold", false]] as [string, boolean][]).map(([c, a]) => (
          <button key={c} style={{ padding: "6px 12px", borderRadius: 999,
            background: a ? t.ink : t.card, color: a ? inkFg : t.ink,
            border: a ? "none" : `1px solid ${t.line}`, fontSize: 11, fontWeight: 700,
            whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 }}>{c}</button>
        ))}
      </div>
      {/* Cards */}
      <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column" }}>
        {hotels.map((r, i) => (
          <div key={i} style={{ paddingTop: 16, borderTop: `1px solid ${t.line}` }}>
            <div style={{ position: "relative" }}>
              <PhotoHero tone={r.tone} style={{ height: 168, borderRadius: 8 }}/>
              {r.best && (
                <div style={{ position: "absolute", top: 8, left: 8, padding: "3px 8px",
                  background: t.ink, color: inkFg, borderRadius: 3,
                  fontSize: 9, fontFamily: t.mono, fontWeight: 800, letterSpacing: "0.06em" }}>
                  ★ BEST VALUE
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              marginTop: 12, gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, color: t.ink, lineHeight: 1.2,
                  letterSpacing: "-0.02em", fontWeight: 800 }}>{r.n}</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 3 }}>{r.sub}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: t.muted, fontFamily: t.mono, fontWeight: 700 }}>FROM</div>
                <div style={{ fontSize: 22, color: t.ink, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  ${r.price.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: t.muted }}>${r.night}/night</div>
              </div>
            </div>
            <div style={{ marginTop: 10, background: dark ? t.blueSoft : "#0a1628",
              borderRadius: 7, padding: "10px 14px",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, color: dark ? t.muted : "#7d8fae",
                  letterSpacing: "0.08em", fontFamily: t.mono, fontWeight: 700 }}>BILT · BEST PORTAL</div>
                <div style={{ fontFamily: t.mono, fontSize: 13, color: t.sky, marginTop: 2, fontWeight: 800 }}>
                  {r.pts} pts <span style={{ color: dark ? t.muted : "#9cb3d8", fontWeight: 600 }}>· {r.cpp}/pt</span>
                </div>
              </div>
              <Icon name="chev-r" size={16} color={t.sky}/>
            </div>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}

// ── Mobile: Flights ───────────────────────────────────────────────────────────

function ScreenCapFlightsMobile({ t, dark }: { t: Tokens; dark: boolean }) {
  const flights = [
    { air: "UA", airline: "UNITED",   code: "UA 1762", dep: "07:15", arr: "10:38", dur: "6h 23m", stop: "Nonstop",   price: "$386", pts: "32,166", cpp: "1.20¢", best: true },
    { air: "AA", airline: "AMERICAN", code: "AA 285",  dep: "11:45", arr: "16:12", dur: "7h 27m", stop: "1 stop·ORD", price: "$418", pts: "27,866", cpp: "1.50¢", best: false },
  ];
  const inkFg = dark ? "#0a0a0a" : "#fff";
  return (
    <MobileShell t={t}>
      {/* Hero */}
      <div style={{ padding: "16px 20px", background: t.card, borderBottom: `1px solid ${t.line}` }}>
        <div style={{ fontSize: 10, letterSpacing: "0.12em", color: t.muted, marginBottom: 6,
          fontFamily: t.mono, fontWeight: 700 }}>FLIGHTS · PHL → SFO</div>
        <div style={{ fontSize: 34, lineHeight: 1.05, color: t.ink, letterSpacing: "-0.03em", fontWeight: 800 }}>
          112 flights<span style={{ color: t.sky }}>.</span>
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 4, fontFamily: t.mono }}>
          APR 27 · ROUND TRIP · 1 ADULT
        </div>
      </div>
      {/* Sort pills */}
      <div style={{ display: "flex", gap: 6, padding: "12px 20px", overflowX: "auto" }}>
        {([["Best value", true], ["Cheapest", false], ["Fastest", false], ["Most pts", false]] as [string, boolean][]).map(([c, a]) => (
          <button key={c} style={{ padding: "6px 12px", borderRadius: 999,
            background: a ? t.ink : t.card, color: a ? inkFg : t.ink,
            border: a ? "none" : `1px solid ${t.line}`, fontSize: 11, fontWeight: 700,
            whiteSpace: "nowrap", cursor: "pointer", flexShrink: 0 }}>{c}</button>
        ))}
      </div>
      {/* Flight cards */}
      <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {flights.map((f, i) => (
          <div key={i} style={{ padding: 14,
            border: `1px solid ${f.best ? t.ink : t.line}`,
            background: f.best ? t.card : "transparent", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: t.ink,
                  color: inkFg, display: "grid", placeItems: "center",
                  fontSize: 10, fontWeight: 800, fontFamily: t.mono }}>{f.air}</div>
                <div style={{ fontSize: 10, fontFamily: t.mono, color: t.muted,
                  fontWeight: 700, letterSpacing: "0.06em" }}>{f.airline} · {f.code}</div>
              </div>
              {f.best && (
                <span style={{ fontSize: 9, fontFamily: t.mono, color: t.sky,
                  fontWeight: 800, letterSpacing: "0.06em" }}>BEST VALUE</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: t.ink,
                fontFamily: t.mono, letterSpacing: "-0.01em" }}>{f.dep}</span>
              <span style={{ fontSize: 10, color: t.muted, fontFamily: t.mono }}>── {f.dur} ──</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: t.ink,
                fontFamily: t.mono, letterSpacing: "-0.01em" }}>{f.arr}</span>
            </div>
            <div style={{ fontSize: 10, color: f.stop === "Nonstop" ? "#0f9d58" : t.muted,
              fontFamily: t.mono, fontWeight: 700, marginTop: 3, letterSpacing: "0.04em" }}>
              {f.stop.toUpperCase()}
            </div>
            <div style={{ marginTop: 10, padding: "9px 12px",
              background: dark ? t.blueSoft : "#0a1628",
              borderRadius: 7, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: t.mono, fontSize: 13, color: t.sky, fontWeight: 800 }}>
                {f.pts} pts{" "}
                <span style={{ fontSize: 10, color: dark ? t.muted : "#9cb3d8", fontWeight: 600 }}>
                  · {f.cpp}/pt
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em",
                color: dark ? t.ink : "#fff" }}>{f.price}</div>
            </div>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}

// ── Mobile: Trip Planner ──────────────────────────────────────────────────────

function ScreenCapTripMobile({ t, dark }: { t: Tokens; dark: boolean }) {
  const stops = [
    { time: "10:42", name: "Amtrak NER",            kind: "TRAIN" },
    { time: "12:30", name: "Hyatt Centric",          kind: "CHECK-IN" },
    { time: "15:00", name: "Reading Terminal Market", kind: "LUNCH" },
    { time: "19:00", name: "Zahav",                  kind: "DINNER" },
  ];
  return (
    <MobileShell t={t}>
      {/* Hero */}
      <div style={{ padding: "16px 20px", background: t.card, borderBottom: `1px solid ${t.line}` }}>
        <div style={{ fontSize: 10, letterSpacing: "0.12em", color: t.muted, marginBottom: 6,
          fontFamily: t.mono, fontWeight: 700 }}>TRIP PLANNER</div>
        <div style={{ fontSize: 30, lineHeight: 1.05, color: t.ink, letterSpacing: "-0.03em", fontWeight: 800 }}>
          Philadelphia<span style={{ color: t.sky }}>.</span>
        </div>
        <div style={{ fontSize: 11, color: t.muted, marginTop: 4, fontFamily: t.mono }}>
          APR 27–30 · 3 NIGHTS · 1 TRAVELER
        </div>
      </div>
      {/* Day selector */}
      <div style={{ display: "flex", background: t.card, borderBottom: `1px solid ${t.line}` }}>
        {([{ d: "27", day: "MON", active: true }, { d: "28", day: "TUE" }, { d: "29", day: "WED" }]).map((day) => (
          <div key={day.d} style={{ flex: 1, padding: "12px 8px", textAlign: "center", cursor: "pointer",
            borderBottom: day.active ? `2px solid ${t.ink}` : "2px solid transparent" }}>
            <div style={{ fontSize: 9, fontFamily: t.mono, color: day.active ? t.ink : t.muted,
              fontWeight: 700, letterSpacing: "0.08em" }}>{day.day}</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1,
              color: day.active ? t.ink : t.muted }}>{day.d}</div>
          </div>
        ))}
      </div>
      {/* Map strip */}
      <div style={{ height: 130, position: "relative", overflow: "hidden" }}>
        <MapTile dark={dark} accent={t.sky} style={{ height: "100%" }}/>
        {([[40, 40, "1"], [60, 60, "2"], [30, 72, "3"]] as [number, number, string][]).map(([x, y, n], i) => (
          <div key={i} style={{ position: "absolute", left: `${x}%`, top: `${y}%`,
            width: 20, height: 20, borderRadius: 20, background: t.sky, border: "2px solid #000",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 800, color: "#000", fontFamily: t.mono,
            transform: "translate(-50%,-50%)" }}>{n}</div>
        ))}
      </div>
      {/* Itinerary */}
      <div style={{ padding: "14px 20px 16px" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: t.ink, marginBottom: 12,
          letterSpacing: "-0.01em" }}>Mon, Apr 27</div>
        {stops.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 12, paddingBottom: 12, marginBottom: 12,
            borderBottom: i < stops.length - 1 ? `1px solid ${t.line}` : "none",
            alignItems: "flex-start" }}>
            <div style={{ fontSize: 10, fontFamily: t.mono, color: t.muted,
              fontWeight: 700, width: 30, paddingTop: 2 }}>{s.time}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{s.name}</div>
              <div style={{ fontSize: 9, color: t.muted, fontFamily: t.mono,
                letterSpacing: "0.06em", fontWeight: 700, marginTop: 2 }}>{s.kind}</div>
            </div>
            <Icon name="chev-r" size={14} color={t.muted}/>
          </div>
        ))}
      </div>
    </MobileShell>
  );
}

// ── Screen-cap carousel ──────────────────────────────────────────────────────

function ScreenCapCarousel({ t, dark, isMobile }: { t: Tokens; dark: boolean; isMobile: boolean }) {
  const [idx, setIdx] = useState(0);
  const screens = [
    { kind: "HOTELS",       tag: "POINTS ENGINE · 40+ PORTALS COMPARED IN ONE QUERY",     node: <ScreenCapHotels      t={t} dark={dark}/>, mobile: <ScreenCapHotelsMobile t={t} dark={dark}/> },
    { kind: "TRIP PLANNER", tag: "MAP-FIRST · DAYS, PINS, ITINERARY — UNLIMITED TRIPS",   node: <ScreenCapTrip        t={t} dark={dark}/>, mobile: <ScreenCapTripMobile   t={t} dark={dark}/> },
    { kind: "FLIGHTS",      tag: "CASH AND POINTS RANKED BY ¢/PT",                        node: <ScreenCapFlights     t={t} dark={dark}/>, mobile: <ScreenCapFlightsMobile t={t} dark={dark}/> },
  ];
  const cur = screens[idx];
  const go = (d: number) => setIdx((idx + d + screens.length) % screens.length);

  const arrowBtn: React.CSSProperties = {
    width: 44, height: 44, borderRadius: 999, background: t.card, border: `1px solid ${t.line}`,
    color: t.ink, display: "inline-flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", padding: 0,
  };

  return (
    <div>
      {/* header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontFamily: t.mono, color: t.ink, letterSpacing: "0.06em", fontWeight: 800 }}>
            ↓ {cur.kind}
          </span>
          {!isMobile && (
            <span style={{ fontSize: 11, fontFamily: t.mono, color: t.muted, letterSpacing: "0.06em", fontWeight: 700 }}>
              {cur.tag}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontFamily: t.mono, color: t.muted, letterSpacing: "0.08em", fontWeight: 700 }}>
            {String(idx+1).padStart(2,"0")} / {String(screens.length).padStart(2,"0")}
          </span>
          <div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
            {screens.map((s, n) => (
              <button key={n} onClick={() => setIdx(n)} aria-label={`Show ${s.kind}`}
                style={{ width: n === idx ? 22 : 8, height: 8, borderRadius: 8,
                  background: n === idx ? t.ink : t.line, border: "none", cursor: "pointer", padding: 0,
                  transition: "width 200ms" }}/>
            ))}
          </div>
          <button onClick={() => go(-1)} aria-label="Previous" style={arrowBtn}>
            <Icon name="chev-l" size={18} color={t.ink}/>
          </button>
          <button onClick={() => go(1)} aria-label="Next" style={arrowBtn}>
            <Icon name="chev-r" size={18} color={t.ink}/>
          </button>
        </div>
      </div>

      {/* screen */}
      {isMobile ? cur.mobile : cur.node}

      {/* tab row */}
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        {screens.map((s, n) => {
          const active = n === idx;
          return (
            <button key={n} onClick={() => setIdx(n)} style={{ flex: 1, padding: "12px 14px", textAlign: "left",
              border: `1px solid ${active ? t.ink : t.line}`, background: active ? t.card : "transparent",
              borderRadius: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 11, fontFamily: t.mono, color: active ? t.ink : t.muted,
                letterSpacing: "0.08em", fontWeight: 800 }}>
                {String(n+1).padStart(2,"0")} · {s.kind}
              </span>
              {active && (
                <span style={{ fontSize: 10, fontFamily: t.mono, color: t.sky, fontWeight: 800,
                  letterSpacing: "0.08em", padding: "2px 6px", background: t.ink, borderRadius: 3 }}>
                  VIEWING
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────────

function Nav({ t, dark, isMobile }: { t: Tokens; dark: boolean; isMobile: boolean }) {
  return (
    <div className="lp-nav" style={{ padding: "22px 64px", display: "flex", justifyContent: "space-between",
      alignItems: "center", borderBottom: `1px solid ${t.line}`, background: t.card,
      position: "sticky", top: 0, zIndex: 50,
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
      <Wordmark color={t.ink} size={isMobile ? 18 : 22}/>
      <div style={{ display: "flex", gap: isMobile ? 8 : 12, alignItems: "center" }}>
        <ThemeToggle/>
        <button
          onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
          style={{ background: t.ink, color: dark ? "#0a0a0a" : "#fff", border: "none",
            borderRadius: 8, padding: isMobile ? "8px 14px" : "9px 16px", fontSize: isMobile ? 12 : 13, fontWeight: 700, cursor: "pointer" }}>
          Join waitlist →
        </button>
      </div>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ t, dark }: { t: Tokens; dark: boolean }) {
  return (
    <div className="lp-hero" style={{ padding: "80px 64px 40px" }}>
      {/* badge + meta row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center",
          padding: "5px 12px", background: t.card, border: `1px solid ${t.line}`,
          borderRadius: 999, fontSize: 11, fontFamily: t.mono, color: t.ink,
          letterSpacing: "0.08em", fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: t.sky }}/>
          WAITLIST OPEN · COMING SOON
        </div>
        <div className="lp-desktop-only" style={{ display: "flex", gap: 24, fontSize: 11, fontFamily: t.mono,
          color: t.muted, letterSpacing: "0.08em", fontWeight: 700 }}>
          <span>40+ PORTALS</span>
          <span>POINTS ENGINE</span>
          <span>TRAVEL PLANNER</span>
        </div>
      </div>

      {/* headline + CTA */}
      <div className="lp-hero-grid" style={{ marginTop: 48, display: "grid",
        gridTemplateColumns: "1.3fr 1fr",
        gap: 72, alignItems: "flex-end" }}>
        <h1 className="lp-hero-h1" style={{ fontSize: "clamp(72px, 10.5vw, 148px)", fontWeight: 800,
          letterSpacing: "-0.04em", lineHeight: 0.92, margin: 0, color: t.ink }}>
          <span style={{ display: "block", padding: 6 }}>Every portal.</span>
          <span style={{ display: "block" }}>One search<span style={{ color: t.sky }}>.</span></span>
        </h1>
        <div>
          <div style={{ width: 40, height: 3, background: t.sky, marginBottom: 20 }}/>
          <p style={{ fontSize: 13, fontFamily: t.mono, color: t.muted, margin: "0 0 12px", letterSpacing: "0.02em" }}>covelo — co- (together) + -velo (swift, flight)</p>
          <p style={{ fontSize: 17, lineHeight: 1.55, color: t.muted, margin: 0, maxWidth: 440, fontWeight: 500 }}>
            Covelo searches every points program at once — Chase, Amex, Capital One, Bilt —
            and ranks them by true cents-per-point value.
          </p>
          <div style={{ marginTop: 28 }}>
            <button
              onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" })}
              style={{ background: t.ink, color: dark ? "#0a0a0a" : "#fff", border: "none",
                borderRadius: 8, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Join waitlist →
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, fontFamily: t.mono, color: t.muted,
            letterSpacing: "0.06em", fontWeight: 700 }}>
           WE'LL EMAIL WHEN WE LAUNCH          </div>
        </div>
      </div>
    </div>
  );
}

// ── What we ship ─────────────────────────────────────────────────────────────

function WhatWeShip({ t }: { t: Tokens }) {
  const cols = [
    { n: "01", t: "Every portal,\nsearched at once.", d: "Chase, Amex, Bilt, Capital One — 40+ redemption portals in a single query. See cash and points side by side.", m: ["40+", "PORTALS"] },
    { n: "02", t: "True value\nper point.", d: "Every result ranked by effective cents-per-point. No more guessing if 1.25¢/pt is actually a deal.", m: ["¢/pt", "ON EVERY ROW"] },
    { n: "03", t: "A planner\nworth using.", d: "Build as many trips as you want. Drop pins, draft itineraries, find your next adventure. Flights and hotels bookings live in the same place as your plans.", m: ["∞", "TRIPS PLANNED"] },
  ];
  return (
    <div className="lp-whip" style={{ padding: "60px 64px" }}>
      <div className="lp-whip-outer" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 56 }}>
        <div>
          <div style={{ fontFamily: t.mono, fontSize: 11, letterSpacing: "0.14em",
            textTransform: "uppercase", color: t.ink, fontWeight: 700 }}>What we ship</div>
          <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em",
            lineHeight: 1.02, color: t.ink, marginTop: 12 }}>
            Three things covelo does exceptionally well<span style={{ color: t.sky }}>.</span>
          </div>
        </div>
        <div className="lp-whip-cols" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 0, borderTop: `2px solid ${t.ink}` }}>
          {cols.map((c, i) => (
            <div key={i} className="lp-whip-col" style={{ padding: "24px 20px",
              borderRight: i < 2 ? `1px solid ${t.line}` : "none" }}>
              <div style={{ fontSize: 12, fontFamily: t.mono, color: t.ink, fontWeight: 700, letterSpacing: "0.1em" }}>{c.n}</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em",
                lineHeight: 1.05, color: t.ink, marginTop: 10, whiteSpace: "pre-line" }}>{c.t}</div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: t.muted, marginTop: 14 }}>{c.d}</div>
              <div style={{ marginTop: 22, paddingTop: 14, borderTop: `1px solid ${t.line}`,
                display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em",
                  color: "#000", background: t.sky, padding: "2px 8px", borderRadius: 4 }}>{c.m[0]}</div>
                <div style={{ fontSize: 10, fontFamily: t.mono, color: t.muted, letterSpacing: "0.08em", fontWeight: 700 }}>{c.m[1]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── The Hunt ─────────────────────────────────────────────────────────────────

function TheHunt({ t, dark }: { t: Tokens; dark: boolean }) {
  const portals = [
    { p: "BILT TRAVEL", pts: "104,134", cpp: "1.25¢", best: true },
    { p: "CHASE",    pts: "108,500", cpp: "1.20¢" },
    { p: "AMEX",     pts: "130,200", cpp: "1.00¢" },
    { p: "CAPITAL ONE",     pts: "186,000", cpp: "0.70¢" },
  ];
  return (
    <div className="lp-hunt" style={{ padding: "80px 64px", background: t.card,
      borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}` }}>
      <div className="lp-hunt-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 64, alignItems: "center" }}>
        {/* copy */}
        <div>
          <div style={{ fontSize: "clamp(48px, 5.5vw, 80px)", fontWeight: 800,
            letterSpacing: "-0.035em", lineHeight: 1, marginTop: 14 }}>
            Your points<br/>are worth more<br/>than you think<span style={{ color: t.sky }}>.</span>
          </div>
          <p style={{ fontSize: 16, color: t.muted, lineHeight: 1.6, marginTop: 24, maxWidth: 480 }}>
            Most cardholders redeem at face value — 1¢ per point. Covelo finds transfer partners
            and sweet spots where the same point can buy 2¢, 3¢, sometimes more.
          </p>
        </div>

        {/* hotel result card mock */}
        <div style={{ background: t.bg, border: `1px solid ${t.line}`, borderRadius: 12, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
            paddingBottom: 16, borderBottom: `1px solid ${t.line}`, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: t.ink }}>
                Hyatt Centric Rittenhouse
              </div>
              <div style={{ fontSize: 11, fontFamily: t.mono, color: t.muted, marginTop: 4,
                letterSpacing: "0.06em", fontWeight: 700 }}>PHL · 3 NIGHTS · APR 27—30</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: t.ink }}>$1,302</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {portals.map((r, i) => (
              <div key={i} style={{ padding: "14px 16px",
                border: r.best ? `2px solid ${t.ink}` : `1px solid ${t.line}`,
                background: r.best ? t.card : "transparent", borderRadius: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: t.mono, fontSize: 10, letterSpacing: "0.08em",
                    color: t.muted, fontWeight: 700 }}>{r.p}</div>
                  {r.best && (
                    <span style={{ padding: "2px 7px", background: t.sky, color: "#000",
                      borderRadius: 3, fontSize: 9, fontFamily: t.mono, fontWeight: 800, letterSpacing: "0.06em" }}>
                      BEST
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: t.mono, fontSize: 16, color: t.ink, marginTop: 6, fontWeight: 700 }}>{r.pts}</div>
                <div style={{ fontSize: 12, color: r.best ? t.ink : t.muted, marginTop: 2, fontWeight: 600 }}>
                  {r.cpp} per point
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "10px 14px", background: t.sky, borderRadius: 6,
            fontSize: 13, color: "#000", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
            <span>→ You&apos;d save $394 booking via Bilt vs face-value UR.</span>
            <Icon name="arrow-r" size={14} color="#000"/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Little things ─────────────────────────────────────────────────────────────

function LittleThings({ t }: { t: Tokens }) {
  const items: { h: string; d: string; disclaimer?: string }[] = [
    {
      h: "One wallet, every card.",
      d: "Connect your Chase, Amex, Bilt, Capital One, Citi cards and travel partner accounts. We'll track your points across all platform.",
      disclaimer: "Card connectivity is part of a future paid tier.",
    },
    {
      h: "Transfer on the fly.",
      d: "See transfer-partner pricing before you move points. No dead-ends.",
    },
    {
      h: "Award calendars.",
      d: "Know when saver space opens up. Search from airlines such as United Airlines, American Airlines, Air France, Delta, and more.",
      disclaimer: "Award calendar alerts are part of a future paid tier.",
    },
    {
      h: "Itinerary, not a PDF.",
      d: "Hotels, flights, activities — all in one map, not a Google Doc.",
    },
  ];
  return (
    <div className="lp-little" style={{ padding: "24px 64px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
        paddingBottom: 16, borderBottom: `2px solid ${t.ink}` }}>
        <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em" }}>
          The little things<span style={{ color: t.sky }}>.</span>
        </div>
        <div style={{ fontFamily: t.mono, fontSize: 11, color: t.muted, letterSpacing: "0.1em", fontWeight: 700 }}>
          04 — 07
        </div>
      </div>
      <div className="lp-little-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32, marginTop: 32 }}>
        {items.map((item, i) => (
          <div key={i}>
            <div style={{ fontSize: 12, fontFamily: t.mono, color: t.ink, letterSpacing: "0.1em", fontWeight: 700 }}>
              {String(i+1).padStart(2,"0")}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.015em",
              color: t.ink, marginTop: 8 }}>{item.h}</div>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 10, lineHeight: 1.55 }}>{item.d}</div>
            {item.disclaimer && (
              <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5,
                padding: "3px 8px", borderRadius: 4,
                border: `1px solid ${t.line}`, background: t.lineSoft }}>
                <span style={{ fontSize: 9, fontFamily: t.mono, color: t.muted,
                  letterSpacing: "0.06em", fontWeight: 700, textTransform: "uppercase" }}>
                  PREMIUM FEATURE
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA({ t }: { t: Tokens }) {
  const issuers = ["Chase", "Amex", "Bilt", "Capital One", "Citi", "Other"];
  return (
    <div id="waitlist" className="lp-cta" style={{ padding: "100px 64px", background: t.navy, color: "#f3f3f1",
      position: "relative", overflow: "hidden" }}>
      {/* grid pattern overlay */}
      <svg viewBox="0 0 1440 600" preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.5 }}>
        <defs>
          <pattern id="cta-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0 L 0 0 0 48" fill="none" stroke="#262629" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="1440" height="600" fill="url(#cta-grid)"/>
      </svg>
      <div className="lp-cta-grid" style={{ position: "relative", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 64, alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: t.mono, fontSize: 11, letterSpacing: "0.14em",
            color: t.sky, fontWeight: 700 }}>COMING SOON · WAITLIST OPEN</div>
          <div style={{ fontSize: "clamp(60px, 7vw, 100px)", fontWeight: 800,
            letterSpacing: "-0.035em", lineHeight: 0.95, marginTop: 14, color: "#fff" }}>
            Get on the<br/>list<span style={{ color: t.sky }}>.</span>
          </div>
          <div style={{ fontSize: 16, color: "#a0a0a0", marginTop: 22, maxWidth: 480, lineHeight: 1.55 }}>
            We&apos;re building covelo now. Drop your email and we&apos;ll send a message
            the day it&apos;s ready.
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14, padding: 24 }}>
          <div style={{ fontSize: 11, fontFamily: t.mono, color: "#a0a0a0",
            letterSpacing: "0.08em", fontWeight: 700 }}>EMAIL</div>
          <input placeholder="you@domain.com" style={{ width: "100%", background: "transparent",
            border: "none", outline: "none", fontSize: 20, color: "#fff", fontWeight: 600,
            padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.2)", fontFamily: t.sans }}/>
          <div style={{ fontSize: 11, fontFamily: t.mono, color: "#a0a0a0",
            letterSpacing: "0.08em", fontWeight: 700, marginTop: 18 }}>PRIMARY ISSUER · OPTIONAL</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {issuers.map((c) => (
              <span key={c} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.06)",
                borderRadius: 999, fontSize: 12, fontWeight: 600, color: "#e4e4e1",
                border: "1px solid rgba(255,255,255,0.1)" }}>{c}</span>
            ))}
          </div>
          <button style={{ width: "100%", marginTop: 24, background: t.sky, color: "#0a0a0a",
            border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 800,
            cursor: "pointer" }}>
            Join waitlist →
          </button>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between",
            fontSize: 10, fontFamily: t.mono, color: "#7a7a7a", letterSpacing: "0.08em", fontWeight: 700 }}>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter({ t }: { t: Tokens }) {
  return (
    <div className="lp-footer" style={{ padding: "32px 64px", background: t.card,
      borderTop: `1px solid ${t.line}`, display: "flex",
      justifyContent: "space-between", fontSize: 11, fontFamily: t.mono,
      color: t.muted, letterSpacing: "0.08em", fontWeight: 700 }}>
      <Wordmark color={t.ink} size={14}/>
      <span className="lp-desktop-only">COVELO · 2026 · <span style={{ color: t.ink }}>EVERY PORTAL. ONE SEARCH.</span></span>
      <span>PRIVACY · TERMS · CONTACT</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const dark     = useHcTheme();
  const isMobile = useIsMobile();
  const t        = getTokens(ACTIVE_PALETTE, dark);

  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: t.sans, minHeight: "100vh" }}>
      <Nav t={t} dark={dark} isMobile={isMobile}/>
      <main>
        <Hero t={t} dark={dark}/>
        <div className="lp-carousel-wrap" style={{ padding: "0 64px 40px" }}>
          <ScreenCapCarousel t={t} dark={dark} isMobile={isMobile}/>
        </div>
        <WhatWeShip t={t}/>
        <TheHunt t={t} dark={dark}/>
        <LittleThings t={t}/>
        <FinalCTA t={t}/>
      </main>
      <LandingFooter t={t}/>
    </div>
  );
}
