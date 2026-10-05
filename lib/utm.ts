// Attribution des ventes : utm_source et utm_campaign, gardés 30 jours dans un
// cookie first-party HttpOnly. Partagé entre le proxy et les Server Actions.

export const UTM_COOKIE = "nonante_utm";
export const UTM_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type Utm = { source: string | null; campaign: string | null };

const NONE: Utm = { source: null, campaign: null };

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 100);
  return /^[\w.~+-]+$/.test(trimmed) ? trimmed : null;
}

/** UTM présents dans l'URL, ou null s'il n'y en a aucun de valide. */
export function utmFromSearchParams(params: URLSearchParams): Utm | null {
  const source = clean(params.get("utm_source"));
  const campaign = clean(params.get("utm_campaign"));
  return source || campaign ? { source, campaign } : null;
}

export function serializeUtm(utm: Utm): string {
  return JSON.stringify(utm);
}

export function parseUtm(raw: string | undefined): Utm {
  if (!raw) return NONE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return NONE;
    const { source, campaign } = parsed as Record<string, unknown>;
    return { source: clean(source), campaign: clean(campaign) };
  } catch {
    return NONE;
  }
}
