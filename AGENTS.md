# AGENTS.md — SplitBill Frontend

Istruzioni per agenti AI e sviluppatori che lavorano su questo repository.

## Contesto

Frontend di **SplitBill** (PWA React per dividere spese tra amici e gruppi). Il backend (Spring Boot, repository `javaWS`) è completo e deployato: qui si consumano solo le API esistenti.

- Documento di progettazione: `progettazione-fe.md` (contratti API, DTO, flussi — fonte di verità)
- Piano di sviluppo: `piano_di_sviluppo.md` (8 sprint, dipendenze, rischi)

## Stack

React 18 · Vite 6 · TypeScript (strict) · Tailwind CSS 4 · shadcn/ui · TanStack Query · React Router · axios · vite-plugin-pwa · Vitest + Testing Library · ESLint 9 (flat config) + Prettier

## Comandi

```bash
npm install          # installazione dipendenze
npm run dev          # dev server su http://localhost:3000 (porta allineata al CORS del backend)
npm run build        # type-check (tsc --noEmit) + build produzione
npm test             # vitest run
npm run test:e2e     # test E2E Playwright (avvia da solo il dev server; i flussi auth richiedono il backend su :8080)
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
│   └── hooks/      # useLogin, useFriends, useGroups, useBills, ...
├── auth/           # context utente, route guard, storage token
├── components/     # componenti UI riusabili
│   ├── ui/         # shadcn/ui (stile base-nova: button, input, card, dialog, sonner, field, ...)
│   └── AppLayout.tsx  # layout con bottom navigation mobile
│   # FriendPicker.tsx: checkbox list per selezionare amici (creazione gruppo, aggiunta membri)
│   # BillForm.tsx: form creazione/modifica spesa con checkbox partecipanti, quote e "Pagato da"; BillCard.tsx: card di una spesa
│   # BillDialogs.tsx: modali creazione/modifica/eliminazione spesa (usate in dettaglio gruppo e amico)
├── lib/            # utilità condivise (cn, money.ts per importi in centesimi, ...) — alias import '@/...'
├── pages/          # una pagina per schermata (vedi progettazione-fe.md §4)
├── router.tsx
└── main.tsx
e2e/                # test E2E Playwright (esclusi da Vitest)
```

## Convenzioni vincolanti

- **JWT**: token in `localStorage` (chiave in `src/api/client.ts`), header `Authorization: Bearer <token>` su tutte le chiamate tranne `/auth/**`. Mai cookie.
- **401**: gestito dall'interceptor in `src/api/client.ts` (svuota token, redirect a `/login`). Non duplicare la logica.
- **429** (rate limit su `/auth/**`): mostrare "Troppe richieste, riprovare tra poco".
- **Errori API**: body `{ timestamp, status, error, message }` → mostrare `message` all'utente (già in italiano).
- **Importi**: 2 decimali; la somma delle quote di una spesa deve pareggiare esattamente l'importo prima dell'invio (il backend rifiuta con 400).
- **Spese**: i dati viaggiano come **query params** (`description`, `amount`, `notes`, `groupId`, `buyerId`), la ripartizione nel **body** come `{ "userId": importo }`. Vale per `POST /bills/new` e `PUT /bills/{id}`. `groupId` è opzionale in creazione: senza gruppo la spesa è personale (tra amici) e si elenca nel dettaglio amico filtrando `/bills/getMyBills`. `buyerId` è opzionale ("Pagato da"): default l'utente autenticato in creazione, il buyer attuale in modifica.
- **Paginazione**: `?page=0&size=20`, risposta `Page<T>` Spring (`content`, `totalElements`, `totalPages`, `number`, ...).
- **Uscita da un gruppo**: i debiti/crediti dell'uscente si estinguono nel gruppo e diventano personali (settlement con `groupId` null).
- **Rimborsi**: passare il `groupId` del settlement; senza `groupId` si saldano solo i debiti personali.
- **Mutazioni**: dopo ogni mutazione invalidare le query TanStack Query correlate (bilanci, settlement, liste).
- **Date**: stringhe ISO dal backend (`YYYY-MM-DD` per LocalDate).
- **Env**: base URL API in `VITE_API_BASE_URL` (vedi `.env.example`). In dev, se assente, il default è `http://<host-della-pagina>:8080` — così i test da smartphone in LAN funzionano senza configurazione. Mai committare `.env`.

## Stile

- Mobile-first: bottom navigation, tap target ≥44px, liste come card (mai tabelle).
- Lingua UI: italiano. Codice, commenti e commit in inglese o coerenti con l'esistente.
- Componenti UI: preferire shadcn/ui; test con Vitest + Testing Library per pagine e hook.
- Modifiche minime e mirate: niente refactor opportunistici fuori scope.
