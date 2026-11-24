// Cliente del API interno de MarketSnack (app.marketsnack.com). Solo servidor.
// Auth: prefiere un token de servidor de larga vida (MARKETSNACK_TOKEN, Bearer) y cae a la
// cookie de sesión (MARKETSNACK_COOKIE) si no hay token. Ver docs/marketsnack-token.md.

import type { RawTrade } from "./flow";

const BASE_URL = "https://app.marketsnack.com";

export class MarketSnackError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "MarketSnackError";
    this.status = status;
  }
}

/**
 * Cabeceras de autenticación. Prefiere el token de servidor de larga vida
 * (MARKETSNACK_TOKEN → Authorization: Bearer); si no hay, cae a la cookie de sesión
 * (MARKETSNACK_COOKIE), que caduca. Ver docs/marketsnack-token.md.
 */
function authHeaders(): Record<string, string> {
  const token = process.env.MARKETSNACK_TOKEN?.trim();
  if (token) return { Authorization: `Bearer ${token}` };

  const c = process.env.MARKETSNACK_COOKIE?.trim();
  if (c) return { Cookie: c };

  throw new MarketSnackError(
    "Falta MARKETSNACK_TOKEN (recomendado) o MARKETSNACK_COOKIE en .env.local. " +
      "Ver docs/marketsnack-token.md.",
  );
}

export interface FetchFlowOptions {
  period?: string; // "1d" | "5d" | "1m"
  maxPages?: number;
  minPremium?: number; // filtro server-side: solo trades con premium ≥ este valor ($)
  targetDays?: number; // detener la paginación al cubrir N días hacia atrás
  onPage?: (page: number, accumulated: number) => void | Promise<void>;
}

export interface FlowResult {
  trades: RawTrade[];
  pages: number;
  truncated: boolean;
}

/**
 * Descarga el flujo (Time & Sales) de un ticker desde MarketSnack, paginando por
 * `next_page_token`. Endpoint: /api/flow_feed?filter[scope]=all&filter[symbol][]=TICKER&period=…
 */
export async function fetchFlow(
  ticker: string,
  opts: FetchFlowOptions = {},
): Promise<FlowResult> {
  const clean = ticker.trim().toUpperCase();
  if (!clean) throw new MarketSnackError("Ticker vacío.");
  return paginate(clean, opts);
}

/**
 * Igual que `fetchFlow` pero SIN filtro de símbolo: devuelve el flujo de todo el
 * mercado. Es lo que alimenta el screener de /ideas — el piso de premium
 * (`minPremium`) filtra server-side, así que el payload se mantiene chico.
 */
export async function fetchMarketFlow(opts: FetchFlowOptions = {}): Promise<FlowResult> {
  return paginate(null, opts);
}

/** Cuerpo de paginación compartido. `symbol === null` → escaneo de todo el mercado. */
async function paginate(
  symbol: string | null,
  opts: FetchFlowOptions = {},
): Promise<FlowResult> {
  const clean = symbol;
  const period = opts.period ?? "5d";
  const maxPages = opts.maxPages ?? 10;
  const authHeader = authHeaders();

  const trades: RawTrade[] = [];
  let token: string | null = null;
  let page = 0;
  let truncated = false;
  // La paginación del feed camina hacia atrás en el tiempo; con targetDays paramos
  // al cubrir la ventana pedida.
  const cutoffMs = opts.targetDays ? Date.now() - opts.targetDays * 86_400_000 : null;

  do {
    page += 1;
    const params = new URLSearchParams();
    params.set("filter[scope]", "all");
    if (clean) params.append("filter[symbol][]", clean);
    params.set("period", period);
    if (opts.minPremium && opts.minPremium > 0) {
      params.set("filter[premium][gte]", String(Math.floor(opts.minPremium)));
    }
    if (token) params.set("next_page_token", token);
    const url = `${BASE_URL}/api/flow_feed?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Accept: "application/json", ...authHeader },
      cache: "no-store",
      redirect: "manual",
    });

    // Auth inválida/expirada → MarketSnack redirige a /login o responde 401/403.
    if (res.status === 401 || res.status === 403 || (res.status >= 300 && res.status < 400)) {
      throw new MarketSnackError(
        "Auth de MarketSnack inválida o expirada. Actualiza MARKETSNACK_TOKEN " +
          "(o la cookie MARKETSNACK_COOKIE) en .env.local. Ver docs/marketsnack-token.md.",
        res.status,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new MarketSnackError(
        `MarketSnack respondió ${res.status}. ${body.slice(0, 200)}`.trim(),
        res.status,
      );
    }

    const json: { list?: RawTrade[]; meta?: { next_page_token?: string } } =
      await res.json();
    const list = json.list ?? [];
    trades.push(...list);
    await opts.onPage?.(page, trades.length);

    token = json.meta?.next_page_token ?? null;
    if (list.length === 0) break;
    if (cutoffMs != null) {
      const oldest = list[list.length - 1]?.timestamp;
      if (oldest && Date.parse(oldest) < cutoffMs) break; // ventana cubierta
    }
    if (page >= maxPages) {
      truncated = Boolean(token);
      break;
    }
  } while (token);

  return { trades, pages: page, truncated };
}
