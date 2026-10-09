"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type Tab = { key: string; href: string; label: string; icon: React.ReactNode; active: boolean };

// Placement de la bulle dans la grille : en classes (CSP stricte, pas de style en ligne au rendu serveur).
const COLS: Record<number, string> = { 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" };
const COL_START = ["col-start-1", "col-start-2", "col-start-3", "col-start-4", "col-start-5", "col-start-6"];
const SPRING = "cubic-bezier(0.3, 1.35, 0.4, 1)";

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Barre d'onglets en verre liquide, façon iOS : une bulle de verre sous l'onglet actif, qui glisse avec un rebond.
 * On peut aussi la faire glisser du doigt d'un onglet à l'autre : elle grossit comme une loupe, s'étire selon la
 * vitesse, et l'onglet sous le doigt s'ouvre au relâchement. Un simple toucher reste un lien normal (clavier compris).
 */
export function LiquidTabBar({ tabs, crowded }: { tabs: Tab[]; crowded: boolean }) {
  const router = useRouter();
  const list = useRef<HTMLUListElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const active = tabs.findIndex((t) => t.active);
  // Onglet visé avant la fin de la navigation : la bulle part tout de suite. Oublié dès que la page change.
  const [optimistic, setOptimistic] = useState<number | null>(null);
  const [seenActive, setSeenActive] = useState(active);
  if (seenActive !== active) {
    setSeenActive(active);
    setOptimistic(null);
  }
  const shown = optimistic ?? active;
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<{ id: number; x0: number; t0: number; last: number; moved: boolean; offset: number } | null>(null);
  const startRect = useRef<DOMRect | null>(null);
  const lastRect = useRef<DOMRect | null>(null);
  const suppressClick = useRef(false);

  // La bulle glisse de son ancienne place à la nouvelle (FLIP), avec un rebond et une goutte qui s'étire.
  useLayoutEffect(() => {
    const el = lens.current;
    if (!el) return;
    const before = startRect.current ?? lastRect.current;
    startRect.current = null;
    el.style.transform = "";
    el.style.scale = "";
    el.removeAttribute("data-drag");
    const now = el.getBoundingClientRect();
    lastRect.current = now;
    if (!before || shown < 0 || reducedMotion()) return;
    const dx = before.left + before.width / 2 - (now.left + now.width / 2);
    if (Math.abs(dx) < 1) return;
    el.animate(
      [
        { transform: `translateX(${dx}px)`, scale: "1.12 1.06" },
        { transform: `translateX(${dx * 0.35}px)`, scale: "1.28 0.9", offset: 0.4 },
        { transform: "translateX(0)", scale: "1 1" },
      ],
      { duration: 560, easing: SPRING },
    );
  }, [shown]);

  // La largeur des onglets change avec l'écran : la position de départ suit.
  useEffect(() => {
    const ul = list.current;
    if (!ul) return;
    const observer = new ResizeObserver(() => {
      if (lens.current) lastRect.current = lens.current.getBoundingClientRect();
    });
    observer.observe(ul);
    return () => observer.disconnect();
  }, []);

  function indexAt(clientX: number): number {
    const ul = list.current!;
    const r = ul.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left) / r.width) * tabs.length);
    return Math.max(0, Math.min(tabs.length - 1, i));
  }

  function go(index: number) {
    const tab = tabs[index];
    if (!tab || index === active) return;
    if (tab.href.startsWith("mailto:")) {
      window.location.href = tab.href;
      return;
    }
    setOptimistic(index);
    router.push(tab.href);
  }

  function onPointerDown(e: React.PointerEvent<HTMLUListElement>) {
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0) || active < 0) return;
    drag.current = { id: e.pointerId, x0: e.clientX, t0: e.timeStamp, last: e.clientX, moved: false, offset: 0 };
  }

  function onPointerMove(e: React.PointerEvent<HTMLUListElement>) {
    const d = drag.current;
    const el = lens.current;
    if (!d || d.id !== e.pointerId || !el) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.x0) < 8) return;
      d.moved = true;
      list.current?.setPointerCapture(e.pointerId);
      el.setAttribute("data-drag", "");
    }
    // La bulle suit le doigt, sans sortir de la barre.
    const ul = list.current!.getBoundingClientRect();
    const cell = el.getBoundingClientRect();
    const center = cell.left + cell.width / 2 - d.offset;
    const x = Math.max(ul.left + cell.width / 2, Math.min(ul.right - cell.width / 2, e.clientX));
    d.offset = x - center;
    el.style.transform = `translateX(${d.offset}px)`;
    // Étirée par la vitesse, comme une goutte.
    const dt = Math.max(1, e.timeStamp - d.t0);
    const speed = Math.min(1, Math.abs(e.clientX - d.last) / dt);
    d.last = e.clientX;
    d.t0 = e.timeStamp;
    el.style.scale = `${1.22 + speed * 0.28} ${1.14 - speed * 0.12}`;
    const i = indexAt(e.clientX);
    if (i !== hover) {
      setHover(i);
      navigator.vibrate?.(6);
    }
  }

  function onPointerEnd(e: React.PointerEvent<HTMLUListElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.moved) return;
    suppressClick.current = true;
    setHover(null);
    const el = lens.current;
    const target = e.type === "pointercancel" ? active : indexAt(e.clientX);
    if (el) startRect.current = el.getBoundingClientRect();
    if (target === active || tabs[target]?.href.startsWith("mailto:")) {
      // Retour à sa place, avec rebond.
      if (el) {
        const from = el.style.transform;
        el.style.transform = "";
        el.style.scale = "";
        el.removeAttribute("data-drag");
        startRect.current = null;
        if (!reducedMotion()) el.animate([{ transform: from, scale: "1.2 1.1" }, { transform: "translateX(0)", scale: "1 1" }], { duration: 480, easing: SPRING });
      }
      if (target !== active) go(target);
      return;
    }
    go(target);
  }

  return (
    <ul
      ref={list}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className={`glass pointer-events-auto mx-auto grid max-w-md touch-none items-stretch rounded-full p-1.5 select-none ${COLS[tabs.length] ?? "grid-cols-6"} ${crowded ? "gap-0.5" : "gap-1"}`}
    >
      <span
        ref={lens}
        aria-hidden="true"
        className={`liquid-lens row-start-1 ${COL_START[Math.max(0, shown)]} ${shown < 0 ? "opacity-0" : ""}`}
      />
      {tabs.map((tab, i) => {
        const lit = hover !== null ? hover === i : i === shown;
        const className = `flex h-14 flex-col items-center justify-center gap-0.5 rounded-full font-medium transition-[color,transform] duration-200 active:scale-90 ${
          crowded ? "text-[9px]" : "text-[10px] tracking-wide"
        } ${lit ? "text-paper" : "text-mute"}`;
        const content = (
          <>
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={lit ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {tab.icon}
            </svg>
            <span className="max-w-full truncate px-0.5">{tab.label}</span>
          </>
        );
        return (
          <li key={tab.key} className={`relative z-10 row-start-1 min-w-0 ${COL_START[i]}`}>
            {tab.href.startsWith("mailto:") ? (
              <a href={tab.href} className={className} draggable={false}>
                {content}
              </a>
            ) : (
              <Link
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={className}
                draggable={false}
                onClick={(e) => {
                  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || i === active) return;
                  setOptimistic(i);
                }}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
