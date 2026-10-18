# Datask: requirements and where each one lives

Status: every item below is implemented. "Proof" names the automated test (`server/tests`) or the browser check (Playwright run) that covers it.

## Functional requirements

### Accounts (JWT, no third-party auth service)
| ID | Requirement | Where | Proof |
|---|---|---|---|
| F1 | Register with name, email, password (min 8 chars, letters + digits) | `main.py /auth/register`, `security.py` | test_auth, browser: validation + duplicate email |
| F2 | Log in; session is a signed JWT (HS256, 7 days) in an httpOnly cookie. Bearer header also accepted | `security.py` | test_auth |
| F3 | Log out clears the cookie | `/auth/logout` | test_auth, browser |
| F4 | Current user endpoint; protected pages redirect to login; stale/expired token ends on `/login?expired=1` with no loop | `/auth/me`, `client/middleware.ts`, `lib/api.ts` | test_auth, browser (stale cookie) |
| F5 | Change password (needs current password) | `/auth/password`, settings page | test_auth |
| F6 | Delete account and all data | `/auth/delete-account`, settings page | test_auth |

### Datasets
| ID | Requirement | Where | Proof |
|---|---|---|---|
| F7 | Upload a CSV (drag/drop or picker) up to 4 MB, 100,000 rows, 100 columns; clear error for wrong type, too big, empty, or unreadable files | `profiling.load_csv`, `upload-zone.tsx` | test_datasets, browser |
| F8 | Auto-detect encoding and delimiter (comma, semicolon, tab); parse "1,200" numbers and most date formats | `profiling.py` | test_datasets |
| F9 | Column profile: type (number/date/category/boolean/text), ranges, examples | `profiling.describe`, `inspector.tsx` | test_datasets, browser |
| F10 | Preview first rows | `/datasets/{id}/preview` | browser |
| F11 | List, rename, delete datasets (max 10 per user); each user sees only their own | `/datasets*` | test_datasets (ownership) |
| F12 | One-click sample dataset (1,500 sales rows) | `samples.py`, `/datasets/sample` | test_datasets, browser |
| F13 | Suggested questions generated from the columns | `profiling.suggestions` | test_datasets, browser |

### Asking questions
| ID | Requirement | Where | Proof |
|---|---|---|---|
| F14 | Ask in English, Roman Urdu or Urdu script; reply in the same language | `llm.py` prompt + `template_answer` | test_ask, browser (Urdu RTL) |
| F15 | Filters (eq, ne, gt, gte, lt, lte, in, contains, between, null checks), group by (incl. year/quarter/month/week/weekday/day/hour), 7 aggregations, sort, limit | `plan.py`, `executor.py` | test_engine |
| F16 | Relative dates ("last month") resolve against the newest date in the data | `executor.py`, `llm.py` | test_engine |
| F17 | Automatic chart: bar, line/area, pie, scatter, single number, table; winner highlighted; user can switch bar/line/pie | `executor.build_chart`, `chart-view.tsx` | test_engine, browser |
| F18 | "How Datask got this": plain-language steps plus the raw plan | `answer-card.tsx` | test_ask, browser |
| F19 | Follow-up questions use the last plans as context | `main.py ask`, `llm.py` | test_ask |
| F20 | Chat history saved per dataset; clear it | `/datasets/{id}/messages` | test_ask, browser |
| F21 | Questions the data cannot answer get a helpful message, not an error | `PlanError` path | test_ask |
| F22 | Empty results are explained | `main.py ask` | test_ask |

### Output and comfort
| ID | Requirement | Where | Proof |
|---|---|---|---|
| F23 | Voice input in English or Urdu (Web Speech API, hidden when unsupported) | `lib/speech.ts`, `composer.tsx` | manual (browser feature) |
| F24 | Download numbers as CSV (Excel-safe, formula-injection guard) and chart as PNG | `lib/export.ts` | browser (both downloads) |
| F25 | Copy answer | `answer-card.tsx` | manual |
| F26 | Privacy mode: AI gets column names only; setting persists | `llm.schema_text`, `page.tsx` | test_ask, browser |
| F27 | Light/dark theme following the system, toggle | `theme-toggle.tsx` | browser |
| F28 | Responsive layout (phone to desktop) with drawer navigation | `sidebar.tsx` | browser at 390px, no horizontal scroll |
| F29 | Keyboard: "/" focuses the question box, Enter sends | `composer.tsx` | browser |
| F30 | Questions-left meter for the day | `/usage`, sidebar | test_ask |
| F31 | Three-way language switch (English / Roman Urdu / Urdu) in the landing header and the question bar; changes landing copy, example questions and voice language; remembered per browser | `lib/lang.tsx`, `lang-switch.tsx`, `landing-*.tsx`, `composer.tsx` | browser (Urdu RTL, Roman) |
| F32 | Floating glass header with logo, section links, language switch, theme switch and call-to-action | `landing-nav.tsx` | browser at 360/390/1440 px |
| F33 | Dataset list shows file name with a "Ready" status and row count; daily plan counter ("59 questions left"); settings shortcut | `sidebar.tsx` | browser |
| F34 | Chart type switch redraws with an entrance animation | `chart-view.tsx` | browser |

## Non-functional requirements

| ID | Area | Requirement | How it is met | Proof |
|---|---|---|---|---|
| N1 | Security | The AI never runs code | It only returns a JSON plan; `plan.py` validates it against the real columns; our pandas code executes it | test_engine (test_invalid_plans_are_rejected, test_strings_are_data_not_code) |
| N2 | Security | Passwords never stored in plain text | scrypt with per-user salt | test_auth |
| N3 | Security | Session cookie hardening | httpOnly, SameSite=Lax, Secure in production | test_auth |
| N4 | Security | Brute-force protection | DB-backed throttles: login 8/15 min per email, register 10/h per IP, password and delete attempts limited | test_auth |
| N5 | Security | Isolation between users | every query filters by `user_id`; other users' ids return 404 | test_datasets |
| N6 | Security | Safe by default | production refuses to start without a strong `JWT_SECRET` and `MONGODB_URI`; security headers set in `next.config.mjs`; no CORS needed (same-origin proxy) | manual |
| N7 | Privacy | Minimal data sent to the AI | schema plus a few example values; none in privacy mode; full file never sent | test_ask |
| N8 | Privacy | Data deletion | deleting a dataset or account removes data and messages | test_datasets, test_auth |
| N9 | Cost control | Daily question limit per user (default 60), refunded when the AI is down | `DAILY_ASK_LIMIT` | test_ask |
| N10 | Reliability | AI outage handled gracefully | 503 with a clear message, retry button, quota refunded; one automatic retry on a malformed plan; template answer if wording step fails | test_ask |
| N11 | Performance | Answers fast | analysis is in-process pandas on at most 100k rows; typical request is under a second apart from the AI call | measured in dev (`took` shown on each answer) |
| N12 | Scalability | Stateless server | all state in MongoDB; fits serverless; datasets stored gzip-compressed | architecture |
| N13 | Portability | Configured by environment variables only | `server/.env.example`, `client/.env.example` | README |
| N14 | Usability | Plain-language UI, loading stages, clear errors with a next step | UI copy, `pending` stages, retry/edit actions | browser |
| N15 | Accessibility | Keyboard reachable, visible focus, skip link, `aria-live` feed, labelled controls, reduced-motion respected, colour is never the only signal | components | browser (partial; no screen-reader audit) |
| N16 | Localisation | Urdu displays right to left with an Urdu font; `dir="auto"` on user text | `layout.tsx`, `globals.css` | browser |
| N17 | Compatibility | Current Chrome, Edge, Firefox, Safari; voice input needs a browser with Web Speech API | graceful hide when absent | Chromium only tested |
| N18 | Maintainability | Typed code, small modules, automated tests | TypeScript strict; pydantic; 46 backend tests | `pytest`, `next build` |
| N19 | Observability | Health endpoint and structured error codes | `/health`, `{"error":{"code","message"}}` | test suite |
| N20 | Limits | Documented hard limits | 4 MB upload (Vercel body limit), 100k rows, 100 columns, 10 datasets/user | tests |

## Known limits
- Vercel serverless bodies are capped at 4.5 MB, hence the 4 MB upload cap.
- Free AI plans have their own rate limits. Check `LLM_MODEL` against the provider's current model list.
- The `mock` AI provider is for local development only and refuses to run in production.
- Voice input depends on the browser; Firefox has no Web Speech API.
