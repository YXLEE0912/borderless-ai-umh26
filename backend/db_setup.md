# Backend Setup Guide (for team members)

## Prerequisites
- Python 3.10+
- PostgreSQL 14+ installed and running
- Git

---

## First-time Setup

### 1. Clone & install dependencies
```bash
git clone https://github.com/your-org/global-trade-navigator.git
cd global-trade-navigator/backend
pip install -r requirements.txt
```

### 2. Configure environment
```bash
# Windows
copy .env.example .env

# Mac/Linux
cp .env.example .env
```

Edit `.env` and fill in:
- `HS_DB_PASSWORD` — your local PostgreSQL password
- `Z_AI_API_KEY` — get from team lead
- `GEMINI_API_KEY` — get from team lead

### 3. Create the database
```sql
-- In pgAdmin or psql:
CREATE DATABASE hsdb;
```

### 4. Run database setup
```bash
python scripts/setup_db.py
```

This will:
- Create all required tables (`pua122_entries`, `pua122_hs_index`)
- Import PUA122 permit data automatically (if Excel file is present)

> **Note:** Place `PUA122_Export_Control_Schedule.xlsx` in the `backend/` folder before running.
> The Excel file is in the team shared drive (not committed to GitHub due to file size).

### 5. Start the server
```bash
uvicorn main:app --reload --port 8000
```

Visit http://localhost:8000/docs to verify everything works.

---

## Project Structure
```
backend/
├── app/
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   │   ├── permit_lookup_service.py   # PUA122 DB queries
│   │   └── ...
│   └── models/          # Pydantic models
├── scripts/
│   └── setup_db.py      # ← Run this after cloning
├── .env.example         # ← Copy to .env
├── .env                 # ← Your local config (NOT in git)
└── main.py
```

---

## Key API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/classification/hs-code` | Classify product + check permits |
| GET  | `/classification/permit-check?hs_code=1511.10.00` | Check permits by HS code |
| GET  | `/health` | Health check |

---

## Troubleshooting

**`ModuleNotFoundError: app.services.permit_lookup_service`**
→ Make sure `app/services/__init__.py` exists (empty file)

**`Connection refused` on DB**
→ Start PostgreSQL: pgAdmin → right-click server → Connect

**Tables missing after setup_db.py**
→ Refresh pgAdmin: right-click `hsdb` → Refresh → Schemas → public → Tables

**`HS_DB_PASSWORD` not set**
→ Check your `.env` file has the correct password