"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ACTIVE_PALETTE, getTokens } from "@/lib/themes";
import { privacyHtml } from "./content";

function useHcTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.getAttribute("data-theme") === "dark");
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const termlyBaseCSS = `
[data-custom-class='body'], [data-custom-class='body'] * { background: transparent !important; }
[data-custom-class='title'], [data-custom-class='title'] * { font-family: Arial !important; font-size: 26px !important; color: #000000 !important; }
[data-custom-class='subtitle'], [data-custom-class='subtitle'] * { font-family: Arial !important; color: #595959 !important; font-size: 14px !important; }
[data-custom-class='heading_1'], [data-custom-class='heading_1'] * { font-family: Arial !important; font-size: 19px !important; color: #000000 !important; }
[data-custom-class='heading_2'], [data-custom-class='heading_2'] * { font-family: Arial !important; font-size: 17px !important; color: #000000 !important; }
[data-custom-class='body_text'], [data-custom-class='body_text'] * { color: #595959 !important; font-size: 14px !important; font-family: Arial !important; }
[data-custom-class='link'], [data-custom-class='link'] * { color: #3030F1 !important; font-size: 14px !important; font-family: Arial !important; word-break: break-word !important; }
`;

const termlyDarkCSS = `
[data-custom-class='title'], [data-custom-class='title'] * { color: #f3f3f1 !important; }
[data-custom-class='heading_1'], [data-custom-class='heading_1'] * { color: #f3f3f1 !important; }
[data-custom-class='heading_2'], [data-custom-class='heading_2'] * { color: #f3f3f1 !important; }
[data-custom-class='body_text'], [data-custom-class='body_text'] * { color: #a0a0a0 !important; }
[data-custom-class='subtitle'], [data-custom-class='subtitle'] * { color: #8a8a90 !important; }
`;

export default function PrivacyPage() {
  const dark = useHcTheme();
  const t = getTokens(ACTIVE_PALETTE, dark);

  return (
    <div style={{ background: t.bg, color: t.ink, fontFamily: t.sans, minHeight: "100vh" }}>
      {/* Sticky nav */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: t.card,
          borderBottom: `1px solid ${t.line}`,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          padding: "16px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.03em",
            color: t.ink,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← <span>covelo<span style={{ opacity: 0.55 }}>.</span></span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 780,
          margin: "0 auto",
          padding: "64px 24px 120px",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: termlyBaseCSS }} />
        {dark && <style dangerouslySetInnerHTML={{ __html: termlyDarkCSS }} />}
        <div dangerouslySetInnerHTML={{ __html: privacyHtml }} />
      </div>
    </div>
  );
}
