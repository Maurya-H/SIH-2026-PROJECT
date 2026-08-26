# 🚧 Civic Issue Tracker — SIH 2026

A smart civic issue reporting and prioritization platform. Citizens report problems on a map; officers view, zone, and triage them using a data-driven **Issue Priority Index (IPI)**.

> 🚧 Potholes · 💧 Waterlogging · 🌳 Fallen Trees · 🛣️ Road Damage · 🏙️ Other Civic Issues

---

## 📑 Table of Contents

1. [Overview](#-overview)
2. [Tech Stack](#-tech-stack)
3. [Team & Responsibilities](#-team--responsibilities)
4. [Architecture](#-architecture)
5. [Issue Priority Index (IPI)](#-issue-priority-index-ipi)
6. [Prerequisites](#-prerequisites)
7. [Getting the Project](#-getting-the-project)
8. [Project Structure](#-project-structure)
9. [Environment Variables](#-environment-variables)
10. [Running the Project](#-running-the-project)
11. [API Overview](#-api-overview)
12. [Git & Branching Workflow](#-git--branching-workflow)
13. [Pull Requests](#-pull-requests)
14. [Repository Privacy & Secrets](#-repository-privacy--secrets)
15. [Troubleshooting](#-troubleshooting)
16. [Team Rules](#-team-rules)
17. [Roadmap](#-roadmap)

---

## 🧭 Overview

Citizens report civic issues with a photo, location, and category through a simple web form. Officers see all issues on a map, group them into **zones**, and use the **IPI score** to decide what to fix first — instead of relying on first-come-first-served or manual judgment.

**Core value proposition for judges:** spatial intelligence (H3 + PostGIS) turns raw complaints into a ranked, zone-aware action list for municipal officers.

---

## 🧰 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + Tailwind CSS + Leaflet | Citizen form, officer dashboard, maps |
| Backend | FastAPI (Python) | REST APIs, business logic, IPI calculation |
| Spatial Processing | PostGIS + H3 | Zones, spatial queries, hexagonal indexing |
| Database | PostgreSQL | Persistent storage |
| Database Environment | Docker Compose | Runs PostgreSQL + PostGIS locally |
| Version Control | GitHub | Source control & collaboration |

---

## 👥 Team & Responsibilities

| Team | Members | Primary Folder | Responsibilities |
|---|---|---|---|
| Frontend | F1, F2 | `frontend/` | Citizen form, officer dashboard, maps, UI/UX, charts |
| Backend | B1, B2 | `backend/` | FastAPI routes, PostGIS/H3 queries, IPI logic, auth |
| Database | D1, D2 | `database/` | Schema, relationships, indexes, migrations, seed data |

**Handoff chain:** D1/D2 design tables → B1/B2 write queries and APIs against them → F1/F2 consume the APIs and render results.

---

## 🏗️ Architecture

```
Citizen/Officer Browser
        │
        ▼
  React + Leaflet (Frontend)
        │  REST calls
        ▼
   FastAPI (Backend)
        │  spatial queries
        ▼
   PostGIS + H3 (inside PostgreSQL)
        │
        ▼
    PostgreSQL (Database)
```

**Example flow:** Officer selects a zone → Frontend calls `/zones/{id}/issues` → Backend builds a spatial query → PostGIS returns matching issues → Backend attaches IPI scores → Frontend renders pins + a sorted list.

---

## 📊 Issue Priority Index (IPI)

The IPI ranks issues so officers know what to act on first. Suggested starting formula (tune weights during development):

```
IPI = (W1 × Severity) + (W2 × VoteCount) + (W3 × AgeInDays) + (W4 × ZoneDensity)
```

| Factor | Meaning | Example Source |
|---|---|---|
| Severity | Category-based base risk (pothole vs. fallen tree) | Set per category |
| VoteCount | How many citizens confirmed/upvoted the same issue | `issue_votes` table |
| AgeInDays | How long the issue has been open and unresolved | `created_at` |
| ZoneDensity | How many other open issues exist in the same H3 cell/zone | H3 aggregation query |

Suggested defaults: `W1=0.4, W2=0.2, W3=0.2, W4=0.2` — Backend team should expose these as configurable constants, not hardcoded magic numbers, so they can be tuned without a redeploy.

---

## 💻 Prerequisites

Every team member installs:

| Tool | Why | Link |
|---|---|---|
| VS Code | Code editor | [Download](https://code.visualstudio.com/) |
| Python 3.12+ | FastAPI backend | [Download](https://www.python.org/downloads/) |
| Node.js LTS | React frontend | [Download](https://nodejs.org/) |
| Docker Desktop | Runs PostgreSQL + PostGIS | [Download](https://www.docker.com/products/docker-desktop/) |
| GitHub Desktop ⭐ recommended | Easier Git for beginners | [Download](https://desktop.github.com/) |

### Do I need Git command line?

- **Beginner-friendly:** use **GitHub Desktop** — clone, branch, commit, push, and PR without typing Git commands.
- **Comfortable with a terminal:** install Git and use `git clone`, `git checkout`, `git add`, `git commit`, `git push`, `git pull`.
- **Never** use "Download ZIP" for active development — it breaks version history and team sync. ZIP is fine only for a one-off look at the code.

---

## 📥 Getting the Project

### Using GitHub Desktop
1. Install GitHub Desktop and sign in with your GitHub account.
2. `File → Clone Repository`
3. Select `Maurya-H/SIH-2026-PROJECT`
4. Choose a save location → `Clone`
5. Open the cloned folder in VS Code.

### Using Git CLI
```bash
git clone https://github.com/Maurya-H/SIH-2026-PROJECT.git
cd SIH-2026-PROJECT
code .
```

---

## 📁 Project Structure

```
SIH-2026-PROJECT/
│
├── frontend/              # React application
│   ├── src/
│   │   ├── components/    # Reusable UI (forms, cards, charts)
│   │   ├── pages/         # Citizen form, officer dashboard
│   │   └── map/           # Leaflet map components
│   └── package.json
│
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/        # /issues, /zones, /ipi, /auth
│   │   ├── services/       # IPI calculation, spatial helpers
│   │   └── models/         # Pydantic schemas
│   └── requirements.txt
│
├── database/                # SQL schema and seed data
│   ├── migrations/
│   └── seed/
│
├── docker-compose.yml        # Starts PostgreSQL + PostGIS
├── .env.example               # Template for local secrets (see below)
├── .gitignore
└── README.md
```

---

## 🔑 Environment Variables

Never commit real secrets. Copy the template and fill in local values:

```bash
cp .env.example .env
```

Example `.env.example` (create this file at repo root if it doesn't exist yet):

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=changeme
POSTGRES_DB=civic_tracker
DATABASE_URL=postgresql://postgres:changeme@localhost:5432/civic_tracker

# Backend
SECRET_KEY=replace_with_a_random_string
ENV=development

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

Make sure `.env` is listed in `.gitignore` — only `.env.example` should ever be committed.

---

## ▶️ Running the Project

### First-time setup

**1. Database**
```bash
docker compose up -d
docker ps          # confirm containers are running
```

**2. Backend**
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1     # Windows PowerShell
# source venv/bin/activate      # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Backend runs at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

**3. Frontend**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at `http://localhost:5173` (check terminal output for the actual port).

### Every day after that

| Terminal | Commands |
|---|---|
| 1 — Database | `docker compose up -d` |
| 2 — Backend | `cd backend` → `.\venv\Scripts\Activate.ps1` → `uvicorn app.main:app --reload` |
| 3 — Frontend | `cd frontend` → `npm run dev` |

No need to reinstall dependencies each time — only when `requirements.txt` or `package.json` changes.

---

## 🔌 API Overview

Suggested initial endpoint set (Backend team to finalize in `backend/app/routers/`):

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/issues` | Citizen submits a new issue (photo, location, category) |
| `GET` | `/issues` | List issues, filterable by zone/category/status |
| `GET` | `/issues/{id}` | Get single issue detail |
| `PATCH` | `/issues/{id}/status` | Officer updates status (open/in-progress/resolved) |
| `GET` | `/zones` | List defined zones |
| `POST` | `/zones` | Officer creates a new zone (polygon) |
| `GET` | `/zones/{id}/issues` | Issues inside a zone, sorted by IPI |
| `GET` | `/ipi/{issue_id}` | Get computed IPI score/breakdown for an issue |

Once endpoints stabilize, keep this table (or a linked `API.md` / the auto-generated `/docs` page) as the source of truth so Frontend isn't guessing at contracts.

---

## 🌿 Git & Branching Workflow

**🚫 Never commit directly to `main`.** It must always stay stable and demo-ready.

```
main
│
├── feature/frontend-citizen-form
├── feature/frontend-dashboard
├── feature/backend-api
├── feature/backend-spatial
├── feature/database-schema
└── feature/database-seed
```

### Creating a branch

**GitHub Desktop:** `Current Branch → New Branch` → name it → `Create Branch`

**Git CLI:**
```bash
git checkout main
git pull origin main
git checkout -b feature/your-branch-name
git branch          # confirms your active branch with a *
```

### Saving work

**GitHub Desktop:** review changed files → write a commit message (e.g. `Add citizen issue form`) → `Commit` → `Push origin`

**Git CLI:**
```bash
git status
git add .
git commit -m "Add citizen issue form"
git push origin feature/your-branch-name
```

### Syncing after a merge

Merged code on GitHub does **not** appear on your machine automatically:
```bash
git checkout main
git pull origin main
git checkout -b feature/your-next-feature
```

---

## 🔀 Pull Requests

A PR = "my work is done, please review before merging into `main`."

1. Go to the repo → **Pull requests → New pull request**
2. Base: `main` ← Compare: `your-branch`
3. Add a clear title (e.g. `Add citizen issue reporting form`) and describe what changed
4. Request a review from a teammate
5. Merge once approved

---

## 🔐 Repository Privacy & Secrets

- Keep the repo **Private** during development; add all 6 members as collaborators.
- **Never commit:** `.env`, passwords, API keys, database credentials.
- Confirm these are in `.gitignore` before your first push:

```gitignore
.env
venv/
node_modules/
__pycache__/
*.pyc
.DS_Store
```

---

## 🚨 Troubleshooting

| Problem | Fix |
|---|---|
| `docker compose` not recognized | Install and open Docker Desktop first |
| Backend: `ModuleNotFoundError` | Activate venv (`.\venv\Scripts\Activate.ps1`) then `pip install -r requirements.txt` |
| `npm` not recognized | Install Node.js LTS, restart terminal/VS Code |
| Frontend loads blank | Check browser console (`F12`) for errors; confirm backend is running |
| Git: "commit your changes before switching branches" | `git status` to review; commit, or `git stash` to save temporarily |
| Merge conflict | Don't delete code blindly — talk to the teammate who owns that section |

---

## ⭐ Team Rules

1. Never code directly on `main`.
2. Always work on your own feature branch.
3. Pull the latest `main` before starting new work.
4. Make small, meaningful commits with clear messages.
5. Test your work locally before opening a PR.
6. Don't modify another team's files without discussing it first.
7. Never commit passwords, keys, or `.env` files.
8. Merge into `main` only through a reviewed Pull Request.
9. On merge conflicts, ask the relevant teammate — don't guess.
10. Keep `main` stable and demo-ready at all times.

---

## 🗺️ Roadmap

- [ ] Finalize database schema (issues, zones, votes, users)
- [ ] Citizen issue submission form + photo upload
- [ ] Officer map dashboard with Leaflet
- [ ] Zone creation (draw polygon → store in PostGIS)
- [ ] H3 indexing for issue density
- [ ] IPI calculation endpoint + tunable weights
- [ ] Officer status updates (open → in-progress → resolved)
- [ ] Basic auth for officer login
- [ ] Deployment plan for demo day
- [ ] Prepare pitch: problem, demo flow, impact metrics

---

## 🎯 Final Architecture

```
                    CIVIC ISSUE TRACKER
                            │
              ┌─────────────┴─────────────┐
              │                           │
          FRONTEND                     BACKEND
          F1 + F2                      B1 + B2
     React + Leaflet               FastAPI + Python
       + Tailwind CSS                     │
              │                  ┌────────┴────────┐
              │                PostGIS             H3
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 ▼
                            PostgreSQL
                                 │
                          DATABASE TEAM
                              D1 + D2
```

Everyone works on their own branch → pushes → opens a Pull Request → gets reviewed → merges into `main`.