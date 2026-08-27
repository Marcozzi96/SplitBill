# SplitBill Frontend — Documento di progettazione

> Documento di contesto per la sessione di sviluppo del frontend di **SplitBill**.
> Backend: repository `javaWS` (Spring Boot 3.5, Java 21), MVP completato (Sprint 1–5), 180 test verdi.
> Ultimo aggiornamento: 2026-08-13

---

## 1. Requisiti e vincoli

- L'app verrà usata **prevalentemente da smartphone Android**.
- **Nessuno sviluppo nativo iOS** previsto.
- L'app deve essere **accessibile anche via browser** (qualsiasi dispositivo).
- Il backend è già completo e deployato; il FE deve consumare le API REST esistenti (sezione 6).
- Il backend è stateless con JWT: niente cookie di sessione.

## 2. Stack tecnologico

| Componente | Scelta | Motivazione |
|------------|--------|-------------|
| Framework | **React 18+** | Ecosistema più ampio, riuso concetti verso React Native se mai servisse |
| Build tool | **Vite** | Dev server istantaneo, build veloce, output statico deployabile ovunque |
| Linguaggio | **TypeScript** | Tipi generabili da OpenAPI del backend |
| App model | **PWA** (`vite-plugin-pwa`) | Un solo codebase: installabile su Android da Chrome ("Aggiungi a schermata home"), funziona in qualsiasi browser. Opzione Play Store futura via TWA/Bubblewrap senza riscrivere codice |
| Data fetching | **TanStack Query** | Cache, loading/error states, invalidazione dopo mutazioni (es. crea spesa → invalida bilanci e settlement) |
| Routing | **React Router** | Standard de facto |
| UI | **Tailwind CSS + shadcn/ui** | Componenti accessibili (dialog, toast, form) senza rigidità; design mobile-first |
| HTTP client | **axios** | Interceptor per header `Authorization` e gestione 401 |
| Typing API | **openapi-typescript** (o `orval`) | Genera i tipi TS da `/v3/api-docs` |

Cose **evitate** deliberatamente: Next.js (SSR inutile dietro login), Angular (troppo pesante per un MVP), Redux (lo stato server lo gestisce TanStack Query; lo stato client residuo sta nei React context), Flutter (Flutter web è mediocre per app di form/liste).

### Design

- **Mobile-first**: layout pensati per schermi piccoli, bottom navigation, tap target ≥44px.
- Liste (spese, amici, gruppi) come card scrollabili, non tabelle.
- Tema chiaro/scuro opzionale (Tailwind `dark:`).

## 3. Software e plugin consigliati

### Software

- **Node.js LTS** (≥20) e **pnpm** (o npm).
- **VS Code** come editor.
- **Git**.
- Per testare da smartphone in LAN: avviare Vite con `vite --host` e aprire l'IP del PC dal telefono (stesso Wi-Fi). Attenzione: il backend deve accettare l'origine — in dev il CORS ammette `http://localhost:3000`, quindi va allineato (vedi sezione 7).

### Estensioni VS Code

- **ESLint** (`dbaeumer.vscode-eslint`)
- **Prettier** (`esbenp.prettier-vscode`)
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- **Error Lens** (`usernamehw.errorlens`) — opzionale ma molto utile
- **Pretty TypeScript Errors** (`yoavbls.pretty-ts-errors`) — opzionale

### Tooling di progetto

- ESLint + Prettier configurati fin da subito.
- `vitest` + `@testing-library/react` per i test (coerente con Vite).
- Chrome DevTools → tab **Application** per debug di manifest PWA e service worker; **Lighthouse** per audit PWA.

## 4. Struttura progetto proposta

```text
src/
├── api/                    # client axios, tipi generati, hook TanStack Query
│   ├── client.ts           # istanza axios + interceptor JWT/401
│   ├── types.ts            # generato da openapi-typescript (non editare a mano)
│   └── hooks/              # useLogin, useGroups, useBills, useSettlements, ...
├── auth/                   # context utente loggato, guard delle rotte, storage token
├── components/             # componenti UI riusabili (shadcn)
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ConfirmEmailPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   ├── FriendsPage.tsx
│   ├── GroupsPage.tsx
│   ├── GroupDetailPage.tsx # membri, spese, bilancio gruppo, settlement
│   ├── NewBillPage.tsx
│   ├── BalancesPage.tsx    # saldo personale + "chi deve a chi"
│   ├── PaymentsPage.tsx    # cronologia rimborsi + nuovo rimborso
│   └── SettingsPage.tsx    # update profilo (username/password), delete account
├── router.tsx
└── main.tsx
```

### Convenzioni

- **Token JWT**: salvato in `localStorage` (mai cookie — il backend ha CSRF disabilitato proprio perché non usa cookie). Inviato come `Authorization: Bearer <token>` su ogni richiesta tranne `/auth/**`.
- **401**: l'interceptor axios svuota il token e reindirizza a `/login`.
- **429** (rate limit su `/auth/**`): mostrare messaggio "Troppe richieste, riprovare tra poco".
- **Errori API**: il body ha sempre la forma `{ timestamp, status, error, message }` — mostrare `message` all'utente (è in italiano).
- **Importi**: `BigDecimal` arriva come numero JSON. Validare lato FE con 2 decimali; la somma dei debiti di una spesa deve pareggiare esattamente l'importo (il backend rifiuta altrimenti con 400).
- **Paginazione**: le liste paginate accettano `?page=0&size=20` e rispondono con una `Page<T>` Spring (vedi 6.2).

## 5. Flussi utente chiave

### Registrazione e conferma email

1. FE: form → `POST /auth/register` → messaggio "Conferma l'email".
2. L'utente riceve una mail con link `{OPEN_LINK}/auth/confirmEmail?token=...`.
   - In produzione `OPEN_LINK` punterà al dominio del FE: il FE deve avere una **route `/auth/confirmEmail`** che legge `token` dalla query string e chiama `GET {API}/auth/confirmEmail?token=...`, mostrando esito (utente creato / token scaduto / già usato).
3. Dopo la conferma → login.

### Reset password

1. `POST /auth/forgotPassword` con l'email → risposta sempre positiva (non rivela se l'email esiste).
2. La mail contiene link `{OPEN_LINK}/resetPassword?token=...` → **route FE `/resetPassword`** con form nuova password → `POST /auth/resetPassword`.
3. Token valido 15 minuti, uso singolo.

### Creazione spesa

1. Seleziona gruppo → il FE carica i membri (`GET /groups/{groupId}/members`).
2. Inserisci descrizione, importo, note e ripartizione per membro (mappa `userId → importo`).
3. Il buyer può essere anche debitore; **la somma delle quote deve essere esattamente uguale all'importo** — validare lato FE prima dell'invio.
4. Dopo la creazione: invalidare query di bilanci e settlement.

### Rimborso

- Da una voce di settlement ("devi X a Y") → `POST /payments`.
- Il backend rifiuta con **409** se l'importo supera il debito effettivo: pre-compilare l'importo massimo con il valore del settlement.
- Passare sempre il `groupId` letto dal `UserSettlementDTO`: i rimborsi **senza** `groupId` saldano solo debiti personali (settlement con `groupId` null), non quelli dentro i gruppi.

### Eliminazione account

- `DELETE /user/delete` (Impostazioni → "Elimina account", conferma testuale `ELIMINA` + avviso sui debiti/crediti aperti) → soft delete con anonimizzazione; poi logout e redirect a `/login`.
- L'eliminato resta nei gruppi come membro passivo: le spese storiche restano, ma non può essere aggiunto a nuove spese (nei form i membri `deleted` non sono selezionabili; in modifica restano se già partecipanti).
- Nei settlement (`/balance/settlements`) la controparte eliminata ha `deleted: true`: il FE mostra un'icona di avviso → popup "Utente eliminato"; se `direction === 'CREDIT'` il popup offre "Dimentica il debito" → `POST /payments/forgive?payerId=&groupId=`.

### Uscita da un gruppo

- `DELETE /groups/leave/{groupId}`: i debiti/crediti dell'uscente **si estinguono nel gruppo** e vengono trasferiti a livello personale (settlement con `groupId` null, visibili in `/balance/settlements` e saldabili con `POST /payments` senza `groupId`).
- Dopo l'uscita il gruppo sparisce da `GET /groups` e l'ex-membro non può più operarci (i check di membership considerano solo i membri attivi).

### Eliminazione gruppo (solo admin)

- `DELETE /groups/{groupId}` senza `force`: se ci sono debiti pendenti arriva **409** con l'elenco → mostrare dialog con i debiti e, se l'utente conferma, ripetere con `?force=true`.

## 6. Documentazione API del backend

### 6.1 Generalità

- **Base URL dev**: `http://localhost:8080`
- **Base URL prod**: `https://javaws.up.railway.app`
- **Swagger UI**: `{BASE}/swagger-ui/index.html` — **OpenAPI JSON**: `{BASE}/v3/api-docs`
- Autenticazione: header `Authorization: Bearer <token>` su tutti gli endpoint tranne `/auth/**` e `/status/**`.
- **Rate limiting**: su `POST /auth/login|register|forgotPassword|resetPassword` max 10 richieste/minuto per IP+endpoint → `429`.
- Formato errore standard:

```json
{ "timestamp": "2026-08-13T10:00:00Z", "status": 400, "error": "Bad Request", "message": "Somma dei debiti diversa dall'importo" }
```

### 6.2 Paginazione

Query params: `page` (default 0), `size` (default 20). Risposta `Page<T>`:

```json
{
  "content": [ /* array di T */ ],
  "totalElements": 42,
  "totalPages": 3,
  "number": 0,
  "size": 20,
  "first": true,
  "last": false
}
```

### 6.3 DTO (forme JSON)

| DTO | Campi |
|-----|-------|
| `UserDTO` | `{ userId: number, username: string, email: string, hasPassword: boolean, deleted: boolean }` — utenti eliminati: `username: "UtenteEliminato"`, `email: null`, `deleted: true` |
| `AuthResponse` | `{ token: string, user: UserDTO }` |
| `GroupDTO` | `{ groupId: number, name: string, description: string, creationDate: "YYYY-MM-DD", users?: UserDTO[], bills?: BillDTO[] }` |
| `GroupMemberDTO` | `{ userId: number, username: string, email: string, role: "ADMIN"\|"MEMBER", dataIngresso: "YYYY-MM-DD", deleted: boolean }` |
| `BillDTO` | `{ billId: number, description: string, creationDate: "YYYY-MM-DD", amount: number, notes: string, buyer: UserDTO, groupId: number, transactions?: TransactionDTO[] }` |
| `TransactionDTO` | `{ transactionId: number, amount: number, userId: number }` |
| `UserBalanceDTO` | `{ userId: number, username: string, totalPaid: number, totalOwed: number, netBalance: number }` — `netBalance = totalPaid − totalOwed` (positivo = ti devono soldi) |
| `UserSettlementDTO` | `{ counterparty: UserDTO, amount: number, direction: "DEBT"\|"CREDIT", groupId: number\|null, groupName: string\|null }` — dal punto di vista dell'utente autenticato: `DEBT` = devi `amount` a `counterparty`; `CREDIT` = `counterparty` deve `amount` a te. `groupId`/`groupName` identificano il gruppo del debito; **null = debito personale** (fuori dai gruppi, tipicamente ereditato da un'uscita) |
| `SettlementDTO` | `{ debtor: UserDTO, creditor: UserDTO, amount: number }` |
| `PaymentDTO` | `{ paymentId: number, payer: UserDTO, payee: UserDTO, groupId: number\|null, amount: number, date: "YYYY-MM-DD", notes: string }` |
| `FriendshipReqRecDTO` | `{ friendshipId: number, applicant: UserDTO, stato: "IN_ATTESA"\|"ACCETTATA"\|"RIFIUTATA", dataRichiesta: "YYYY-MM-DDTHH:mm:ss", messaggio: string }` |
| `FriendshipReqSenDTO` | come sopra, ma con `recipient` al posto di `applicant` |

> Le date sono stringhe ISO (`LocalDate` → `YYYY-MM-DD`, `LocalDateTime` → ISO con orario). Gli importi sono numeri JSON.

### 6.4 Endpoint — Autenticazione (pubblici, rate limited)

| Metodo | Path | Input | Output | Errori |
|--------|------|-------|--------|--------|
| POST | `/auth/login` | body `{ username?, email?, password }` (username **o** email) | `AuthResponse` | 401 credenziali non valide |
| POST | `/auth/register` | body `{ username, email, password }` | `200` stringa conferma | 400 username/email già usati |
| GET | `/auth/confirmEmail?token=` | query `token` | `UserDTO` | 400 token scaduto/usato/non valido |
| POST | `/auth/forgotPassword` | body `{ email }` | `200` sempre | 429 |
| POST | `/auth/resetPassword` | body `{ token, newPassword }` | `200` stringa | 400 token scaduto/usato/non valido |

### 6.5 Endpoint — Utenti e amicizie (`/user`, autenticati)

| Metodo | Path | Input | Output | Note |
|--------|------|-------|--------|------|
| GET | `/user/me` | — | `UserDTO` | |
| PUT | `/user/update` | body `{ username?, email?, password?, oldPassword }` | `AuthResponse` | `oldPassword` obbligatoria; ritorna **nuovo token da sostituire**; 401 password errata, 409 username/email già in uso |
| DELETE | `/user/delete` | — | `200` | Soft delete + anonimizzazione; storico spese preservato. Nei DTO l'utente eliminato appare come `username: "UtenteEliminato"`, `email: null`, `deleted: true` |
| POST | `/user/sendFriendshipRequest?name=&message=` | query `name` (username o email), `message` | `200` | 400 se già amici/richiesta pendente |
| GET | `/user/getFriends?page=&size=` | paginata | `Page<UserDTO>` | Ordine alfabetico per username (case-insensitive) |
| GET | `/user/getFriendshipReqReceived?page=&size=` | paginata | `Page<FriendshipReqRecDTO>` | |
| GET | `/user/getFriendshipReqSent?page=&size=` | paginata | `Page<FriendshipReqSenDTO>` | |
| GET | `/user/friendshipRequests/count` | — | `{ count: number }` | Badge notifiche |
| PUT | `/user/acceptFriendship?friendId=` | query `friendId` = `applicant.userId` | `200` | |
| PUT | `/user/refuseFriendship?friendId=` | query `friendId` | `200` | |
| DELETE | `/user/cancelFriendship?friendId=` | query `friendId` | `200` | Rimuove un'amicizia accettata |

### 6.6 Endpoint — Gruppi (`/groups`, autenticati)

| Metodo | Path | Input | Output | Note |
|--------|------|-------|--------|------|
| POST | `/groups/create?name=&description=` | query + body `number[]` (userId degli amici) | `GroupDTO` | Il creatore diventa `ADMIN` |
| GET | `/groups?page=&size=` | paginata | `Page<GroupDTO>` | Gruppi dell'utente (solo membership attive: i gruppi da cui è uscito non compaiono) |
| GET | `/groups/{groupId}` | path | `GroupDTO` | Solo membri |
| PUT | `/groups/{groupId}?name=&description=` | query | `GroupDTO` | Solo admin (403) |
| DELETE | `/groups/{groupId}?force=` | query `force` (default false) | `200` | Solo admin; **409 con debiti pendenti** se `force=false` |
| POST | `/groups/addUsers/{groupId}` | body `number[]` (userId amici) | `GroupDTO` | |
| DELETE | `/groups/leave/{groupId}` | path | `200` | Uscita soft; se ultimo membro il gruppo è eliminato. **I debiti/crediti dell'uscente si estinguono nel gruppo e diventano personali** (settlement con `groupId` null) |
| GET | `/groups/{groupId}/members` | path | `GroupMemberDTO[]` | Membri attivi con ruolo |
| GET | `/groups/{groupId}/settlement-status` | path | `SettlementDTO[]` | Debiti pendenti netti (al netto di rimborsi e uscite) tra i membri — per dialog eliminazione |
| GET | `/groups/{groupId}/balance` | path | `UserBalanceDTO` | Saldo dell'utente autenticato nel gruppo |
| GET | `/groups/{groupId}/settlements` | path | `UserSettlementDTO[]` | "Chi deve a chi" dal punto di vista dell'utente, nel gruppo |

### 6.7 Endpoint — Spese (`/bills`, autenticati)

| Metodo | Path | Input | Output | Note |
|--------|------|-------|--------|------|
| POST | `/bills/new?description=&amount=&notes=&groupId=&buyerId=` | query + body `{ "userId": importo, ... }` | `BillDTO` | Somma debiti **= amount esatto**; il buyer può essere tra i debitori; 400 dati non validi. **`groupId` opzionale**: senza gruppo la spesa è personale (tra amici) e i debitori devono essere amici del buyer. **`buyerId` opzionale** ("Pagato da"): default l'utente autenticato |
| GET | `/bills/group/{groupId}?page=&size=` | paginata | `Page<BillDTO>` | Solo membri del gruppo; dalla più recente |
| GET | `/bills/getMyBills?page=&size=` | paginata | `Page<BillDTO>` | Spese in cui l'utente è coinvolto; dalla più recente |
| GET | `/bills/getWhereImBuyer?page=&size=` | paginata | `Page<BillDTO>` | Spese pagate dall'utente; dalla più recente |
| PUT | `/bills/{id}?description=&amount=&notes=&buyerId=` | query + body mappa debiti | `BillDTO` | Qualsiasi membro attivo del gruppo (per le personali: chiunque sia coinvolto); stesse validazioni della creazione; `buyerId` opzionale per cambiare chi ha pagato |
| DELETE | `/bills/{id}` | path | `204` | Qualsiasi membro attivo del gruppo (per le personali: chiunque sia coinvolto) (401/404) |

> **Attenzione**: i dati della spesa viaggiano come **query params** (`description`, `amount`, `notes`, `groupId`) mentre la ripartizione va nel **body JSON** come oggetto `{ "1": 50.00, "2": 50.00 }`. Lo stesso vale per `PUT /bills/{id}`.

### 6.8 Endpoint — Rimborsi (`/payments`, autenticati)

| Metodo | Path | Input | Output | Note |
|--------|------|-------|--------|------|
| POST | `/payments?payeeId=&amount=&groupId=&notes=` | query (`groupId`, `notes` opzionali) | `PaymentDTO` | payer = utente autenticato; **409 se supera il debito effettivo** |
| POST | `/payments/forgive?payerId=&groupId=` | query (`groupId` opzionale) | `PaymentDTO` | "Dimentica il debito": estingue l'intero debito che un utente **eliminato** (`payerId`) ha verso l'autenticato; 400 se payer non eliminato o nessun debito |
| GET | `/payments?page=&size=` | paginata | `Page<PaymentDTO>` | Rimborsi in cui l'utente è payer o payee; dalla più recente |

### 6.9 Endpoint — Bilanci (`/balance`, autenticati)

| Metodo | Path | Output | Note |
|--------|------|--------|------|
| GET | `/balance/me` | `UserBalanceDTO` | Saldo globale personale |
| GET | `/balance/settlements` | `UserSettlementDTO[]` | "Chi deve a chi" globale, solo verso l'utente autenticato |
| GET | `/balance/{userId}` | `UserBalanceDTO` | Solo se `userId` = utente autenticato (altrimenti 401) — preferire `/balance/me` |

### 6.10 Endpoint — Stato

| Metodo | Path | Note |
|--------|------|------|
| GET | `/status/isOn` | Pubblico, health check → `"ok"` |

## 7. Allineamenti backend necessari quando il FE andrà online

1. **CORS**: aggiungere l'origine del FE a `GlobalCorsConfig` (oggi: `http://localhost:3000`, `https://fe-splitbill.vercel.app`).
2. **`OPEN_LINK`**: puntare al dominio del FE, così i link email (conferma registrazione, reset password) atterrano sulle route del FE (sezione 5).
3. In dev, se si testa da smartphone in LAN, allineare CORS e `server.address` del backend.

## 8. Mappatura schermate ↔ endpoint

| Schermata | Endpoint principali |
|-----------|---------------------|
| Login / Register / Forgot / Reset / Confirm | `/auth/*` |
| Home (bilanci + cronologia rimborsi in tab) | `/balance/me`, `/balance/settlements`, `POST /payments`, `GET /payments`, `/user/friendshipRequests/count` |
| Amici | `/user/getFriends`, `/user/getFriendshipReq*`, send/accept/refuse/cancel |
| Lista gruppi | `/groups`, `/groups/create` |
| Dettaglio gruppo | `/groups/{id}`, `/groups/{id}/members`, `/bills/group/{id}`, `/groups/{id}/balance`, `/groups/{id}/settlements` |
| Nuova spesa (dettaglio o FAB globale) | `/groups/{id}/members` + `POST /bills/new` |
| Profilo | `/user/me`, `/user/update`, `/user/delete` |

## 9. Comandi di riferimento backend

```bash
# Avvio backend in dev (H2 in-memory, porta 8080)
./mvnw spring-boot:run

# Health check
curl http://localhost:8080/status/isOn

# Login di prova (dopo aver registrato+confermato un utente)
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"mario","password":"Password123!"}'
```

> Nota dev: senza `JWT_SECRET` impostata il backend genera una chiave effimera a ogni riavvio → i token emessi si invalidano a ogni restart del backend (logout forzato nel FE). Per evitarlo: `export JWT_SECRET=$(openssl rand -base64 64)`.
