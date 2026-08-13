# AGENTS.md — SplitBill Frontend

Istruzioni per agenti AI e sviluppatori che lavorano su questo repository.

## Contesto

Frontend di **SplitBill** (PWA React per dividere spese tra amici e gruppi). Il backend (Spring Boot, repository `javaWS`) è completo e deployato: qui si consumano solo le API esistenti.

- Documento di progettazione: `progettazione-fe.md` (contratti API, DTO, flussi — fonte di verità)
- Piano di sviluppo: `piano_di_sviluppo.md` (7 sprint, dipendenze, rischi)

## Stack

React 18 · Vite 6 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · TanStack Query · React Router · axios · vite-plugin-pwa · Vitest + Testing Library · ESLint 9 (flat config) + Prettier

## Comandi

```bash
npm install          # installazione dipendenze
npm run dev          # dev server su http://localhost:3000 (porta allineata al CORS del backend)
npm run build        # type-check (tsc --noEmit) + build produzione
npm test             # vitest run
npm run lint         # eslint
npm run format       # prettier
npm run gen:types    # rigenera src/api/types.ts da http://localhost:8080/v3/api-docs
```

Prima di considerare chiuso un task: `npm run lint`, `npm test` e `npm run build` devono essere verdi.

## Struttura

```text
src/
├── api/            # client axios, tipi generati, hook TanStack Query
│   ├── client.ts   # istanza axios + interceptor JWT/401
│   ├── types.ts    # GENERATO da openapi-typescript — non editare a mano
│   └── hooks/      # useLogin, useGroups, useBills, ...
├── auth/           # context utente, route guard, storage token
├── components/     # componenti UI riusabili
│   ├── ui/         # shadcn/ui (stile base-nova: button, input, card, dialog, sonner, field, ...)
│   └── AppLayout.tsx  # layout con bottom navigation mobile
├── lib/            # utilità condivise (cn, ...) — alias import '@/...'
├── pages/          # una pagina per schermata (vedi progettazione-fe.md §4)
├── router.tsx
└── main.tsx
```

## Convenzioni vincolanti

- **JWT**: token in `localStorage` (chiave in `src/api/client.ts`), header `Authorization: Bearer <token>` su tutte le chiamate tranne `/auth/**`. Mai cookie.
- **401**: gestito dall'interceptor in `src/api/client.ts` (svuota token, redirect a `/login`). Non duplicare la logica.
- **429** (rate limit su `/auth/**`): mostrare "Troppe richieste, riprovare tra poco".
- **Errori API**: body `{ timestamp, status, error, message }` → mostrare `message` all'utente (già in italiano).
- **Importi**: 2 decimali; la somma delle quote di una spesa deve pareggiare esattamente l'importo prima dell'invio (il backend rifiuta con 400).
- **Spese**: i dati viaggiano come **query params** (`description`, `amount`, `notes`, `groupId`), la ripartizione nel **body** come `{ "userId": importo }`. Vale per `POST /bills/new` e `PUT /bills/{id}`.
- **Paginazione**: `?page=0&size=20`, risposta `Page<T>` Spring (`content`, `totalElements`, `totalPages`, `number`, ...).
- **Mutazioni**: dopo ogni mutazione invalidare le query TanStack Query correlate (bilanci, settlement, liste).
- **Date**: stringhe ISO dal backend (`YYYY-MM-DD` per LocalDate).
- **Env**: base URL API in `VITE_API_BASE_URL` (vedi `.env.example`). Mai committare `.env`.

## Stile

- Mobile-first: bottom navigation, tap target ≥44px, liste come card (mai tabelle).
- Lingua UI: italiano. Codice, commenti e commit in inglese o coerenti con l'esistente.
- Componenti UI: preferire shadcn/ui; test con Vitest + Testing Library per pagine e hook.
- Modifiche minime e mirate: niente refactor opportunistici fuori scope.
