# Campus Customs: Yale Merch Storefront + AI Shop Assistant (HW4)

A customer-facing Campus Customs website built with **React + Vite + TypeScript** and a **FastAPI** backend. It includes a **PydanticAI** shopping assistant that answers price and stock questions from the SQLite database, shows matching products as cards on the page, remembers logged-in customers, and logs every agent run to an append-only audit trail.

- Full system documentation: [`output/harness.md`](output/harness.md)
- Design notes: [`output/design.md`](output/design.md) · Usability improvements: [`output/usability.md`](output/usability.md)
- Grading page (open by double-clicking): [`output/app_check.html`](output/app_check.html)
- Prompt log: [`AI_prompts.md`](AI_prompts.md)

## Project layout

```
hw4/
├── backend/            FastAPI app (main.py), PydanticAI agent (agent.py), tools.py, models.py,
│   └── prompts/        prompt.md (system prompt + safety rules); also auth.py, history.py, audit.py, db.py
├── frontend/           React + Vite + TypeScript site
├── output/             harness.md, design.md, usability.md, app_check.html + images, audit_trail.json
├── data/               ← NOT in git: place the provided data pack here (see below)
├── requirements.txt    Python dependencies
└── .env.example        Environment variable template
```

## 1. Put the data pack in place (required)

The database and product images are **not committed**. Unzip the provided course data pack so this structure exists inside `hw4/`:

```
hw4/data/campus_customs.db
hw4/data/products/*.jpg          (102 product images)
```

On first start the backend adds two tables to the database if they're missing (`sessions` and `chat_history`). Product data is never modified.

## 2. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORTKEY_API_KEY` | yes | Portkey key used to call the OpenAI model `gpt-5.6-luna` |

Copy `.env.example` to `.env` (in `hw4/`, or the folder above it) and fill in your key. `.env` is git-ignored. Never commit it.

## 3. Backend (FastAPI): http://localhost:8000

Requires Python 3.12+. From `hw4/`:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # macOS/Linux: .venv/bin/python -m pip ...
```

Start it from **inside `backend/`**:

```bash
cd backend
source ../.venv/Scripts/activate        # Windows PowerShell: ..\.venv\Scripts\Activate.ps1 · macOS/Linux: source ../.venv/bin/activate
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## 4. Frontend (React + Vite): http://localhost:5173

Requires Node 20+. In a second terminal, from `hw4/`:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` and `/media` to the backend on port 8000, so start the backend first.

Test account: `test@campuscustoms.yale.edu` / `password` (from the provided database), or create a new account on the site.

## Ports

| Service | Port |
|---|---|
| React/Vite frontend | 5173 |
| FastAPI backend | 8000 |
