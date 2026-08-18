# SplitBill Frontend — Piano di sviluppo

> Piano diviso in sprint per lo sviluppo del frontend di **SplitBill**, basato su `progettazione-fe.md`.
> Backend già completo e deployato (Spring Boot, `https://javaws.up.railway.app`): il FE consuma solo le API esistenti.
> Durata ipotizzata: 1 settimana per sprint (stima indicativa, da ricalibrare dopo lo Sprint 1).
> Ultimo aggiornamento: 2026-08-16

> **Stato avanzamento**: Sprint 1–6 completati (fondamenta, autenticazione, amici, gruppi, spese, revisione flussi creazione spesa). Spesa personale senza `groupId` verificata E2E sul backend reale il 2026-08-18. Prossimo: Sprint 7 — Bilanci e rimborsi.

---

## Obiettivo complessivo

PWA mobile-first (React 18 + Vite + TypeScript) installabile su Android e usabile da browser, che copre tutti i flussi: autenticazione, amici, gruppi, spese con ripartizione, bilanci, rimborsi, profilo.

## Regole trasversali (valide in ogni sprint)

- Token JWT in `localStorage`, header `Authorization: Bearer <token>` su tutte le chiamate tranne `/auth/**`.
- Interceptor axios: su **401** svuota il token e reindirizza a `/login`; su **429** mostra "Troppe richieste, riprovare tra poco".
- Errori API: body `{ timestamp, status, error, message }` → mostrare `message` (già in italiano).
- Importi: 2 decimali, validazione lato FE; la somma delle quote di una spesa deve pareggiare esattamente l'importo.
- Liste paginate: `?page=0&size=20`, risposta `Page<T>` Spring.
- Dopo ogni mutazione: invalidare le query TanStack Query correlate (bilanci, settlement, liste).
- Ogni sprint si chiude con: lint pulito, test verdi, feature verificata da smartphone (o emulazione mobile) contro il backend reale.

---

## Sprint 1 — Fondamenta del progetto ✅

**Obiettivo**: scaffold funzionante con tutto il tooling pronto.

- Setup Vite + React 18 + TypeScript, ESLint + Prettier, Vitest + Testing Library.
- Tailwind CSS + shadcn/ui (componenti base: button, input, card, dialog, toast, form).
- React Router con layout principale e bottom navigation mobile (tap target ≥44px).
- Istanza axios (`src/api/client.ts`) con interceptor JWT / 401 / 429.
- TanStack Query provider e convenzione hook in `src/api/hooks/`.
- Generazione tipi TS da `/v3/api-docs` con openapi-typescript (script npm, output in `src/api/types.ts`).
- PWA base: `vite-plugin-pwa`, manifest minimo, icone placeholder.
- Gestione variabili ambiente: `VITE_API_BASE_URL` (dev `http://localhost:8080`, prod Railway).

**Done**: `pnpm dev` avvia, routing tra pagine placeholder funzionante, tipi generati, `lint`/`test`/`build` verdi.

## Sprint 2 — Autenticazione ✅

**Obiettivo**: flusso completo registrazione → conferma email → login → logout.

- `AuthContext` (utente loggato, token, login/logout) e route guard per le pagine protette.
- Pagine: `LoginPage`, `RegisterPage`, `ConfirmEmailPage`, `ForgotPasswordPage`, `ResetPasswordPage`.
- Route FE dedicate ai link email: `/auth/confirmEmail?token=` e `/resetPassword?token=` (leggono il token dalla query string e chiamano l'API, mostrando esito/errore).
- Hook: `useLogin`, `useRegister`, `useConfirmEmail`, `useForgotPassword`, `useResetPassword`.
- Gestione errori specifici: 401 credenziali, 400 username/email duplicati, 400 token scaduto/usato, 429 rate limit.

**Done**: un utente reale si registra, conferma via email, fa login e logout; token persistente tra reload; 401 forza il logout.

## Sprint 3 — Amici ✅

**Obiettivo**: gestione completa delle amicizie.

- `FriendsPage` con tab: amici (paginata), richieste ricevute, richieste inviate.
- Invio richiesta (`sendFriendshipRequest` con username/email + messaggio), accetta/rifiuta/annulla amicizia.
- Badge con `friendshipRequests/count` sulla bottom navigation.
- Hook: `useFriends`, `useFriendshipRequests*`, mutazioni con invalidazione.

**Done**: due utenti reali diventano amici passando per richiesta/accettazione; badge aggiornato senza reload.

## Sprint 4 — Gruppi ✅

**Obiettivo**: creazione e gestione dei gruppi.

- `GroupsPage`: lista gruppi paginata + creazione (nome, descrizione, selezione amici).
- `GroupDetailPage`: info gruppo, lista membri con ruolo (`/groups/{id}/members`).
- Azioni admin: modifica nome/descrizione, aggiunta membri.
- Eliminazione gruppo: dialog che su **409** mostra i debiti pendenti (`settlement-status`) e consente il retry con `?force=true`.
- Uscita dal gruppo (`leave`).

**Done**: creazione gruppo con amici, gestione membri e ruoli, eliminazione con e senza debiti pendenti verificata.

## Sprint 5 — Spese ✅

**Obiettivo**: il flusso centrale dell'app.

- `NewBillPage`: selezione gruppo → caricamento membri → descrizione, importo, note e ripartizione per membro (mappa `userId → importo`).
- Validazione FE: somma quote **esattamente uguale** all'importo (2 decimali) prima dell'invio; buyer incluso tra i debitori se serve.
- Attenzione al contratto API: dati spesa in **query params**, ripartizione nel **body JSON** (vale anche per `PUT /bills/{id}`).
- Liste spese: per gruppo (`/bills/group/{id}`), "dove sono coinvolto", "dove ho pagato" — come card scrollabili.
- Modifica ed eliminazione spesa (solo buyer o admin gruppo).
- Invalidazione di bilanci e settlement dopo ogni mutazione.

**Done**: creazione spesa con ripartizione libera e bilanciata; modifica/eliminazione; rifiuto 400 gestito con messaggio chiaro.

## Sprint 6 — Revisione flussi di creazione spesa ✅

**Obiettivo**: le spese si creano solo nel contesto giusto (gruppo o amico); via il tab "Spese" dalla navigazione.

- Rimozione del tab "Spese" dalla bottom navigation (`AppLayout`); eliminazione di `BillsPage`, del suo test e della route `/bills` (le spese restano visibili nel dettaglio gruppo).
- `BillForm` con checkbox per partecipante: di default tutti selezionati; i deselezionati sono esclusi dalla ripartizione; "Dividi equamente" divide solo tra i selezionati; validazione somma quote solo sui selezionati; almeno un partecipante obbligatorio. In modifica, preselezionati i membri che hanno già una quota.
- Creazione spesa in **modale** (`CreateBillDialog`, stesso `BillForm` della modifica): dal dettaglio gruppo (con `groupId`) e dal dettaglio amico (senza `groupId`, spesa personale). La pagina `NewBillPage` e la route `/bills/new` sono state eliminate.
- Spesa personale tra amici: partecipanti = utente corrente + amico; `POST /bills/new` senza `groupId`. **Verifica preventiva sul backend reale**: il contratto OpenAPI dichiara `groupId` obbligatorio — se rifiuta (400) serve una modifica backend (parametro opzionale) prima di chiudere il flusso.
- `FriendsPage`: box di ricerca che filtra la lista per username/email (client-side, sulla pagina caricata); click sulla card → dettaglio amico.
- Dettaglio amico: cliccando sulla card di un amico si apre `/friends/{userId}` con l'elenco delle spese **senza gruppo** condivise con quell'amico (filtro client-side su `/bills/getMyBills`: `groupId` nullo e amico coinvolto come buyer o debitore).
- Test: aggiornare `NewBillPage.test.tsx` (entrambi i flussi), `FriendsPage.test.tsx` (ricerca + pulsante +), test di `BillForm` (checkbox); rimuovere `BillsPage.test.tsx`.

**Done**: nuova spesa creabile solo da dettaglio gruppo o da card amico; checkbox partecipanti con default "tutti"; ricerca amici e dettaglio amico con spese senza gruppo; menu senza "Spese"; lint/test/build verdi.

## Sprint 7 — Bilanci e rimborsi

**Obiettivo**: chiudere il ciclo dei soldi.

- `BalancesPage`: saldo globale (`/balance/me`) + "chi deve a chi" (`/balance/settlements`); saldi per gruppo nel dettaglio gruppo.
- `PaymentsPage`: cronologia rimborsi paginata + nuovo rimborso.
- Rimborso avviato da una voce di settlement con importo **pre-compilato al massimo del debito**; gestione **409** (importo superiore al debito effettivo).
- Home/Dashboard: saldo personale, settlement in evidenza, badge richieste amicizia.

**Done**: da un settlement si registra un rimborso e il bilancio si aggiorna; 409 gestito; dashboard coerente.

## Sprint 8 — Profilo, PWA e rilascio

**Obiettivo**: app completa, installabile e online.

- `ProfilePage`: visualizzazione profilo, update (sostituire il **nuovo token** restituito da `/user/update`), delete account con conferma.
- Tema chiaro/scuro (Tailwind `dark:`).
- PWA completa: manifest definitivo, icone reali, service worker, strategia cache; audit **Lighthouse** PWA verde.
- Polish mobile: stati di caricamento/errore/vuoto su tutte le liste, test da smartphone reale.
- Deploy (es. Vercel) e **allineamenti backend**: origine FE in `GlobalCorsConfig`, `OPEN_LINK` puntato al dominio del FE.

**Done**: app installabile su Android da Chrome, audit PWA positivo, flussi email (conferma/reset) funzionanti in produzione, tutti i flussi utente della sezione 5 del documento di progettazione verificati end-to-end.

---

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Contratti API "inusuali" (dati spesa in query params, ripartizione in body) | Testare contro il backend reale fin dallo Sprint 2; esempi curl nel documento di progettazione |
| CORS non allineato in dev (test da smartphone in LAN) | Risolto: il FE usa di default l'host della pagina per le API e il backend accetta origini LAN private via `allowedOriginPatterns` |
| Token invalidati a ogni restart del backend in dev (chiave JWT effimera) | Impostare `JWT_SECRET` fissa nel backend di dev |
| Precisione importi (float JSON) | Validazione FE a 2 decimali + controllo somma quote prima dell'invio |
| ~~Spese personali senza gruppo~~ | **Risolto** (Sprint 6, verificato E2E il 2026-08-18): `groupId` è opzionale in `POST /bills/new`; la spesa personale tra amici funziona |
| Link email che puntano al backend invece che al FE | Route FE `/auth/confirmEmail` e `/resetPassword` pronte dallo Sprint 2; `OPEN_LINK` allineato nel rilascio |

## Dipendenze tra sprint

- Sprint 1 sblocca tutto; Sprint 2 sblocca 3–7 (serve un utente autenticato).
- Sprint 3 (amici) è prerequisito di Sprint 4 (la creazione gruppo seleziona gli amici).
- Sprint 5 (spese) è prerequisito di Sprint 6 (revisione dei flussi di creazione) e Sprint 7 (bilanci e rimborsi significativi richiedono spese).
- Sprint 8 richiede il resto completato.
