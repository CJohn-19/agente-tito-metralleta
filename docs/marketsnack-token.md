# MarketSnack: pasar de cookie de sesión a token de servidor de larga vida

**Objetivo:** dejar de autenticar Tito contra MarketSnack con la **cookie de sesión**
del navegador (`MARKETSNACK_COOKIE`), que **caduca en días**, y usar en su lugar un
**token de servidor que no expira**. Como MarketSnack es producto propio, basta con
emitir ese token una vez y Tito deja de necesitar refrescos manuales.

> De esto dependen 4 de los 6 sub-agentes del scorecard: **Agresividad, Convicción,
> Contexto IV** y el **Time & Sales**. Sin un acceso válido, esos paneles quedan vacíos.

El cambio tiene **dos lados**: el backend de MarketSnack (emitir y aceptar el token) y
el código de Tito (usarlo). Más una alternativa rápida al final.

---

## Parte A — En el backend de MarketSnack (el servidor)

1. **Crear un token de larga vida** ligado a tu cuenta. Según tu stack:
   - una tabla tipo `api_tokens` / `personal_access_tokens` con un valor aleatorio largo
     (32–64 bytes hex), **sin expiración** (o muy lejana) y que puedas **revocar**; o
   - si tu framework ya trae "API tokens" (Laravel Sanctum, Rails `has_secure_token`,
     Django DRF TokenAuth, etc.), generar uno con esa herramienta.
2. **Hacer que `/api/flow_feed` acepte ese token**, además de (o en vez de) la cookie.
   Lo estándar es leer el header **`Authorization: Bearer <token>`**: si viene un token
   válido, autenticar por él y saltarse la sesión/cookie. Deja la cookie funcionando para
   que la web normal de MarketSnack no se rompa.
3. **Guardar el token en un lugar seguro.** Trátalo como una contraseña: no lo subas a
   git y revócalo si se expone.

> Esto ocurre en el repo de **MarketSnack**, no en el de Tito.

### Contrato que Tito espera del endpoint
- Método/ruta: `GET https://app.marketsnack.com/api/flow_feed`
- Query actual: `filter[scope]=all`, `filter[symbol][]=TICKER` (opcional; sin él = todo el
  mercado), `period=5d`, `filter[premium][gte]=N` (opcional), `next_page_token=…` (paginación)
- Auth nueva: header `Authorization: Bearer <token>`
- Respuesta JSON: `{ "list": [ …trades… ], "meta": { "next_page_token": "…" } }`
- Debe responder **401/403** (no un redirect a `/login`) si el token es inválido.

---

## Parte B — En el código de Tito (`web/lib/marketsnack.ts`)

Hoy la auth es por cookie:

```ts
function cookie(): string {
  const c = process.env.MARKETSNACK_COOKIE;
  if (!c || !c.trim()) throw new MarketSnackError("Falta MARKETSNACK_COOKIE…");
  return c.trim();
}
// …dentro de paginate():
const res = await fetch(url, {
  headers: { Accept: "application/json", Cookie: cookieHeader },
  cache: "no-store",
  redirect: "manual",
});
```

Sustituir la función `cookie()` por una que **prefiera el token** y caiga a la cookie solo
si no hay token (así nada se rompe durante la transición):

```ts
function authHeaders(): Record<string, string> {
  const token = process.env.MARKETSNACK_TOKEN?.trim();
  if (token) return { Authorization: `Bearer ${token}` };

  const c = process.env.MARKETSNACK_COOKIE?.trim();
  if (c) return { Cookie: c };

  throw new MarketSnackError(
    "Falta MARKETSNACK_TOKEN (recomendado) o MARKETSNACK_COOKIE en .env.local.",
  );
}
```

Y en el `fetch` de `paginate` (~línea 93) usar el spread de headers:

```ts
const res = await fetch(url, {
  headers: { Accept: "application/json", ...authHeaders() },
  cache: "no-store",
  redirect: "manual",
});
```

Reemplazar también `const cookieHeader = cookie();` (~línea 71) por la nueva función, o
quitar esa variable y llamar `authHeaders()` directo en el `fetch`. El bloque de error de
"sesión inválida/expirada" (~líneas 100-105) puede quedar igual; solo conviene actualizar el
texto para que mencione el token.

---

## Parte C — Configuración y prueba

1. En `web/.env.local` añadir (con el token real):
   ```
   MARKETSNACK_TOKEN=tu_token_de_larga_vida
   ```
   Documentar la variable también en `web/.env.example` (sin valor).
2. Levantar la app: `cd web` → `npm run dev`. Buscar un ticker líquido (p. ej. `AAPL`) y
   confirmar que el **Time & Sales** y los sub-agentes de **Agresividad/Convicción/IV** se llenan.
3. Correr `npm test` para asegurar que nada se rompió.

---

## Alternativa rápida (temporal, sin tocar MarketSnack)

Volver a pegar la cookie de sesión (caduca otra vez en días):
logueado en `app.marketsnack.com` → **DevTools → Network** → request a `/api/flow_feed` →
copiar el header **`Cookie`** completo → pegarlo en `MARKETSNACK_COOKIE` de `web/.env.local`.

---

_Relacionado: `PENDIENTES.md` (raíz del repo). Última edición de este doc: 2026-11-22._
