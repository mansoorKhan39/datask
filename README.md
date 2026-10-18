# Datask

*Data + Ask.* 
Upload a CSV, ask questions in English, Roman Urdu or Urdu, get a one-sentence answer, a chart and the steps behind it.

- `client/` Next.js 14 (App Router, TypeScript, Tailwind, Recharts)
- `server/` FastAPI + pandas, JWT auth, MongoDB
- `docs/REQUIREMENTS.md` every functional and non-functional requirement with where it lives and how it is tested

## How it stays safe
The AI only writes a small JSON plan (filter, group, aggregate, sort, chart). The server checks it against the real columns and runs it with its own pandas code. No AI-written code is ever executed.

## Run locally
```bash
# terminal 1: API (uses an in-memory database and a keyword "mock" AI)
cd server
pip install -r requirements-dev.txt
cp .env.example .env            # optional; or export the variables
DATASK_ENV=development python -m uvicorn main:app --port 8000

# terminal 2: website
cd client
npm install
cp .env.example .env.local      # BACKEND_URL=http://127.0.0.1:8000
npm run dev                     # http://localhost:3000
```
Tests: `cd server && pytest`. Production build check: `cd client && npm run build`.

The mock AI only understands simple keyword questions and exists so you can try the app without a key. For real language understanding set `GEMINI_API_KEY` or `GROQ_API_KEY`.

## Environment variables (server)
| Name | Needed in production | Notes |
|---|---|---|
| `JWT_SECRET` | yes | 32+ random characters. `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
| `MONGODB_URI` | yes | MongoDB Atlas connection string |
| `MONGODB_DB` | no | default `datask` |
| `GEMINI_API_KEY` or `GROQ_API_KEY` | yes | free keys from Google AI Studio or Groq |
| `LLM_MODEL` | no | defaults may be retired; check the provider's current model list and set this |
| `DAILY_ASK_LIMIT` | no | default 60 questions per user per day |
| `COOKIE_SECURE` | no | on by default in production |

Client: `BACKEND_URL` = address of the deployed server.

## Free setup
1. **MongoDB Atlas** (no card): create a free M0 cluster, add a database user, under Network Access allow `0.0.0.0/0` (Vercel has no fixed IP), copy the connection string into `MONGODB_URI`.
2. **AI key**: create a free key at Google AI Studio (Gemini) or console.groq.com and set it as above.

## Deploy on Vercel (two projects from one repo)
1. Push the repo to GitHub.
2. **Server project**: New Project, pick the repo, Root Directory `server`. Add `JWT_SECRET`, `MONGODB_URI`, the AI key and `DATASK_ENV=production`. Deploy, then open `/health` on its URL and confirm it shows `"db":"mongo"` and your provider.
3. **Client project**: New Project, same repo, Root Directory `client`. Add `BACKEND_URL` = the server project's URL (no trailing slash). Deploy.
4. Open the client URL, register, click "Open sample data" and ask a question.

The browser only talks to the client domain; `/api/*` is proxied to the server, so the cookie is same-origin and no CORS setup is needed.

## Limits to know
- Vercel request bodies are capped at 4.5 MB, so uploads are capped at 4 MB (also 100,000 rows, 100 columns, 10 datasets per user).
- Serverless functions have a time limit; very slow AI responses can time out. Raise the function duration in project settings if your plan allows.
- Free AI plans have their own rate limits.
