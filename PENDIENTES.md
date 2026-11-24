# Pendientes — Agente Tito Metralleta

> Lista viva de trabajo. Se actualiza conforme avanza el proyecto.
> Si surge un paso nuevo necesario o recomendable para el funcionamiento óptimo
> del agente, se **añade aquí** y se notifica al usuario mostrando la lista actualizada.

Última actualización: **2026-11-23**

---

## 🔴 Prioritario

- [ ] **Refrescar el acceso a MarketSnack** (sin él no funcionan Agresividad, Convicción,
      Contexto IV ni el Time & Sales — 4 de los 6 sub-agentes dependen de esta fuente).
      **Pasos detallados: [docs/marketsnack-token.md](docs/marketsnack-token.md).**
  - [x] **Parte B — código de Tito (hecho 2026-11-23):** `web/lib/marketsnack.ts` ya prefiere
        `MARKETSNACK_TOKEN` (Bearer) y cae a la cookie si no hay token; `.env.example` y el
        mensaje de error de `/ideas` actualizados. Typecheck y 430 tests en verde. No rompe nada.
  - [ ] **Parte A — backend de MarketSnack (pendiente, fuera de este repo):** emitir el token
        de larga vida y hacer que `/api/flow_feed` acepte `Authorization: Bearer`. Se hace donde
        vive el código de MarketSnack (no está en este equipo).
  - [ ] **Parte C — configurar y probar:** poner `MARKETSNACK_TOKEN=<token>` en `web/.env.local`,
        levantar la app y confirmar que Time & Sales / Agresividad / Convicción / IV se llenan.
  - Alternativa rápida (temporal, si solo quieres probar ya): pegar la cookie de sesión del
    navegador en `MARKETSNACK_COOKIE` (caduca de nuevo en días).

## 🟡 Trabajo de producto

- [ ] **Decidir qué hacer con la rama `feat/wheel-strategy`** (16 commits adelante de `main`,
      ya respaldada en el fork `origin`): ¿fusionar a `main`? ¿abrir Pull Request a Víctor (`upstream`)?
- [ ] **Definir y construir los Sub Agentes de confirmación de contexto** (carpeta `Sub Agentes/`
      vacía). La Tarea 4 (Buy Put = cobertura **o** direccional) pide "validación de contexto con
      otros agentes" (p. ej. macro, técnico, noticias).

## 🟢 Seguimiento / a tener presente

- [ ] **Históricos que se acumulan "hacia adelante"** (cadena 45d, IV 365d, trades, predicciones):
      empiezan delgados; la Memoria/Accuracy dirá "aún no hay datos vencidos" hasta que pasen los días.
      Hay que dejar correr el agente con regularidad para que acumulen valor.
- [ ] **Sync automático con Robinhood = solo la máquina de Víctor** (usa `launchd` en Mac).
      En este Windows el ⭐ se encola en `data/outbox.json` pero **no se sincroniza solo**.
      Decidir si se quiere una alternativa para Windows o se deja manual.

---

## ✅ Hecho / verificado

- [x] **Key de Massive válida** — verificada 2026-11-22 (HTTP 200 en referencia y option chain).
      `MASSIVE_API_KEY` está puesta en `web/.env.local` (32 chars). La misma suscripción
      (~$30 "Options Starter") sirve a este proyecto y a "A. Opciones"; no hay nada que mover.
- [x] **`cleanupPeriodDays` = 3650** en `~/.claude/settings.json` — Claude Code ya no borra
      chats viejos por antigüedad (causa de la sesión perdida de ago-2026).

---

## Registro de cambios de esta lista

- **2026-11-22** — Lista creada a partir del recuento de estado del proyecto. Key de Massive
  verificada (válida). `cleanupPeriodDays` configurado.
- **2026-11-23** — MarketSnack Parte B hecha: `marketsnack.ts` acepta `MARKETSNACK_TOKEN` (Bearer)
  con cookie de respaldo; typecheck + 430 tests en verde. Faltan Parte A (backend) y Parte C (probar).
