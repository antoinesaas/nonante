"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { fmt } from "@/lib/i18n/format";

type Props = {
  /** Départ, en ms depuis l'époque Unix. */
  target: number;
  /** Heure du serveur au rendu : corrige une horloge de téléphone mal réglée. */
  serverNow: number;
};

function split(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function Countdown({ target, serverNow }: Props) {
  const { m, locale } = useI18n();
  const [remaining, setRemaining] = useState(target - serverNow);

  useEffect(() => {
    const skew = serverNow - Date.now();
    const id = setInterval(() => setRemaining(target - (Date.now() + skew)), 1000);
    return () => clearInterval(id);
  }, [target, serverNow]);

  const { days, hours, minutes, seconds } = split(remaining);
  const cells = [
    { value: String(days), label: fmt(m.common.units.days, { n: days }, locale).replace(/^[\d\s.,]+/, "") },
    { value: pad(hours), label: m.common.units.h },
    { value: pad(minutes), label: m.common.units.min },
    { value: pad(seconds), label: m.common.units.s },
  ];

  return (
    <div>
      <p className="sr-only">
        {fmt(m.common.countdown.aria, { days, hours, minutes })}
      </p>
      <div aria-hidden="true" className="flex items-baseline gap-4 sm:gap-6">
        {cells.map((cell) => (
          <div key={cell.label} className="flex items-baseline gap-1.5">
            <span className="font-serif text-5xl leading-none tabular-nums sm:text-6xl">{cell.value}</span>
            <span className="text-sm text-mute">{cell.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
