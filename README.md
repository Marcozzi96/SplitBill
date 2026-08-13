# SplitBill — Frontend

PWA mobile-first per dividere le spese tra amici e gruppi. Consuma le API REST del backend Spring Boot (`javaWS`), già completo e deployato.

## Stack

- **React 18 + TypeScript + Vite** — build tool con output statico
- **PWA** (`vite-plugin-pwa`) — installabile su Android da Chrome, usabile da qualsiasi browser
- **TanStack Query** — cache e stato del server
- **React Router** — routing
- **Tailwind CSS 4 + shadcn/ui** — UI mobile-first
- **axios** — interceptor per JWT e gestione 401/429
- **Vitest + Testing Library** — test

## Requisiti

- Node.js ≥ 20 (consigliato LTS) e npm
- Backend in esecuzione (dev: `http://localhost:8080`, vedi `progettazione-fe.md` §9)

## Avvio rapido

```bash
npm install
cp .env.example .env.local   # opzionale, default già http://localhost:8080
npm run dev                  # http://localhost:3000
```

Per testare da smartphone nella stessa rete Wi-Fi: il dev server espone già `--host`; apri `http://<ip-del-pc>:3000` dal telefono (richiede CORS allineato sul backend, vedi `progettazione-fe.md` §7).

## Script

| Comando | Descrizione |
|---------|-------------|
| `npm run dev` | Dev server (porta 3000) |
| `npm run build` | Type-check + build di produzione in `dist/` |
| `npm run preview` | Anteprima della build |
| `npm test` | Test con Vitest |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run gen:types` | Rigenera i tipi TS da `/v3/api-docs` del backend locale |

## Variabili d'ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8080` | Base URL del backend (prod: `https://javaws.up.railway.app`) |

## Documentazione

- `progettazione-fe.md` — progettazione, contratti API, DTO, flussi utente
- `piano_di_sviluppo.md` — piano di sviluppo diviso in sprint
- `AGENTS.md` — convenzioni per agenti AI e contributor
