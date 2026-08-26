SIH 2026 — Civic Issue Tracker 🚧

A smart civic issue reporting platform where citizens can report problems like:

🚧 Potholes
💧 Waterlogging
🌳 Fallen trees
🛣️ Road damage
🏙️ Other civic issues

Officers can view reported issues on a map, create zones, and use an Issue Priority Index (IPI) to decide which issues need attention first.

🧰 Tech Stack
Part	Technology	What it does
Frontend	React + Tailwind CSS + Leaflet	Website, dashboard and maps
Backend	FastAPI + Python	APIs and application logic
Spatial Processing	PostGIS + H3	Location-based operations and spatial indexing
Database	PostgreSQL	Stores application data
Database Environment	Docker	Runs PostgreSQL + PostGIS
Code Management	GitHub	Stores and manages the project
👥 Team

We have 6 members divided into 3 teams.

Team	Members	Main Work
Frontend	F1 + F2	React, Tailwind, Leaflet, UI, dashboard, maps
Backend	B1 + B2	FastAPI, APIs, PostGIS, H3, spatial queries, IPI
Database	D1 + D2	PostgreSQL, database schema, tables, relationships, indexes, migrations, seed data
How Backend and Database work together

PostGIS is a PostgreSQL extension, but in our project the Backend team will use PostGIS for spatial operations.

Frontend
   ↓
FastAPI Backend
   ↓
PostGIS / H3
   ↓
PostgreSQL Database

For example:

Officer selects a zone → Backend sends a spatial query → PostGIS finds issues inside the zone → Backend processes the result → Frontend displays the issues.

💻 What You Need to Install

Every team member should install:

1. VS Code

Used for writing and editing code.

Download VS Code

2. Python 3.12+

Required for the FastAPI backend.

Download Python

3. Node.js LTS

Required for the React frontend.

Download Node.js

4. Docker Desktop

Used to run PostgreSQL + PostGIS.

Download Docker Desktop

5. GitHub Desktop ⭐ Recommended

GitHub Desktop makes Git easier for beginners.

Download GitHub Desktop

❓ Do I Need Git?
⭐ Recommended: GitHub Desktop

If you don't know Git commands, use GitHub Desktop.

You can do things like:

Clone project
      ↓
Create branch
      ↓
Write code
      ↓
Commit
      ↓
Push
      ↓
Pull Request

without typing most Git commands.

Alternative: Git Command Line

You can also install Git and use commands such as:

git clone
git checkout
git add
git commit
git push
git pull
⚠️ Download ZIP

You can download the project using:

GitHub → Code → Download ZIP

But do not use ZIP for regular team development.

ZIP is okay if you only want to look at the project.

For our 6-person team, use:

GitHub Desktop or Git

📥 Getting the Project
Using GitHub Desktop
Install GitHub Desktop.
Sign in with your GitHub account.
Open GitHub Desktop.
Select:
File → Clone Repository
Select:
Maurya-H/SIH-2026-PROJECT
Choose where you want to save the project.
Click Clone.

Then open the project in VS Code.

Open SIH-2026-PROJECT on GitHub

📁 Project Structure
SIH-2026-PROJECT/
│
├── frontend/
│   └── React application
│
├── backend/
│   └── FastAPI application
│
├── database/
│   └── SQL schema and seed data
│
├── docker-compose.yml
│
├── .gitignore
│
└── README.md
frontend/

Contains everything users see:

Citizen Report Form
Officer Dashboard
Maps
Issue Details
Buttons
Charts
backend/

Contains the application logic:

FastAPI
APIs
PostGIS
H3
Spatial Queries
IPI Calculation
Communication with Database
database/

Contains database-related work:

Tables
Relationships
Indexes
Migrations
Seed Data
docker-compose.yml

Used to start our database using Docker.

🗄️ Step 1 — Start Database

Make sure Docker Desktop is open.

Open a terminal in the project folder:

docker compose up -d

This starts:

PostgreSQL
     +
PostGIS

Check that Docker is running:

docker ps
🐍 Step 2 — Start Backend

Open a new terminal.

Go to the backend:

cd backend
First time only

Create a Python virtual environment:

python -m venv venv

Activate it:

.\venv\Scripts\Activate.ps1

Install the required packages:

pip install -r requirements.txt

Start FastAPI:

uvicorn app.main:app --reload

The backend should be available at:

http://localhost:8000
⚛️ Step 3 — Start Frontend

Open another new terminal.

Go to the frontend:

cd frontend
First time only

Install packages:

npm install

Start the frontend:

npm run dev

For a Vite React project, the frontend is usually available at:

http://localhost:5173

If the terminal shows a different URL, use the URL shown there.

🔄 Every Time You Work on the Project

You don't need to reinstall everything.

Start the three parts:

Terminal 1 — Database
docker compose up -d
Terminal 2 — Backend
cd backend
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
Terminal 3 — Frontend
cd frontend
npm run dev
🌿 IMPORTANT — Branches
🚫 Never work directly on main

main is the stable version of our project.

Every member should create their own branch.

Example:

main
│
├── feature/frontend-citizen-form
├── feature/frontend-dashboard
├── feature/backend-api
├── feature/backend-spatial
├── feature/database-schema
└── feature/database-seed
🌱 Creating Your Branch
GitHub Desktop
Open GitHub Desktop.
Select the project.
Click Current Branch.
Click New Branch.
Give your branch a meaningful name.

Examples:

feature/frontend-citizen-form
feature/frontend-dashboard

feature/backend-api
feature/backend-spatial

feature/database-schema
feature/database-seed
Click Create Branch.

Now you can work safely without directly changing main.

💻 If You Use Git Commands

First update main:

git checkout main
git pull origin main

Create your branch:

git checkout -b feature/your-branch-name

Check your branch:

git branch

You should see:

* feature/your-branch-name
  main

The * shows your current branch.

💾 Saving Your Work
GitHub Desktop ⭐

After coding:

Save your files.
Open GitHub Desktop.
Check the changed files.
Enter a commit message.

Example:

Add citizen issue form
Click Commit.
Click Push origin.
Git Commands

Check changes:

git status

Add changes:

git add .

Commit:

git commit -m "Add citizen issue form"

Push:

git push origin feature/your-branch-name
🔀 Pull Request

A Pull Request (PR) means:

"I finished my work. Please check it before adding it to the main project."

The workflow is:

Your Branch
     ↓
   Push
     ↓
  GitHub
     ↓
Pull Request
     ↓
Review
     ↓
Merge
     ↓
  main
🔎 Creating a Pull Request

Go to our GitHub repository:

SIH-2026-PROJECT

Then:

Click Pull requests.
Click New pull request.
Select your branch.
Make sure:
your-branch → main
Add a clear title.

Example:

Add citizen issue reporting form
Explain what you changed.
Create the Pull Request.
Ask a teammate to review it.
Merge it when it is ready.
🔄 After Someone Merges Code

Suppose F1 finishes a feature and merges it into main.

Your computer does not automatically receive the new code.

Before starting new work, update your project.

Using Git:

git checkout main
git pull origin main

Then create your next branch:

git checkout -b feature/your-new-feature
🧑‍💻 Team Workflow
Frontend — F1 + F2

Mainly work inside:

frontend/

Technologies:

React
Tailwind CSS
Leaflet

Work examples:

Citizen form
Officer dashboard
Maps
UI
Issue display
Backend — B1 + B2

Mainly work inside:

backend/

Technologies:

FastAPI
Python
PostGIS
H3

Work examples:

APIs
Spatial queries
H3 indexing
IPI calculation
Business logic
Database — D1 + D2

Mainly work inside:

database/

Technologies:

PostgreSQL
PostGIS configuration
SQL

Work examples:

Tables
Relationships
Indexes
Migrations
Seed data
Database structure
Important

Backend and Database teams will work together.

For example:

D1/D2
   ↓
Design database tables
   ↓
B1/B2
   ↓
Write FastAPI + PostGIS queries
   ↓
Frontend
   ↓
Display results
🔐 Repository Privacy

Keep the repository Private while developing the SIH project.

Add all 6 team members as collaborators.

Never upload:

.env
Passwords
API keys
Secret keys
Database passwords

Make sure these are included in .gitignore.

🚨 Common Problems
"docker compose" is not recognized

Make sure Docker Desktop is installed and running.

Backend says module not found

Activate the virtual environment:

.\venv\Scripts\Activate.ps1

Then:

pip install -r requirements.txt
npm is not recognized

Install Node.js LTS and restart your terminal/VS Code.

Frontend is blank

Open:

F12 → Console

Check for errors.

Also make sure the backend is running.

Git says:
Please commit your changes before switching branches

Check:

git status

If you want to keep your changes, commit them.

If you want to temporarily save them:

git stash
🚀 Complete Daily Workflow
1. Open Docker Desktop
          ↓
2. Open GitHub Desktop
          ↓
3. Get latest project changes
          ↓
4. Create/use your own branch
          ↓
5. Open project in VS Code
          ↓
6. Start Database
          ↓
7. Start Backend
          ↓
8. Start Frontend
          ↓
9. Write your code
          ↓
10. Test your work
          ↓
11. Commit
          ↓
12. Push your branch
          ↓
13. Create Pull Request
          ↓
14. Review
          ↓
15. Merge into main
⭐ Team Rules
Never directly code on main.
Always work on your own branch.
Pull the latest code before starting new work.
Make small, meaningful commits.
Test your code before creating a PR.
Don't modify another team's work without discussing it.
Never upload passwords or API keys.
Use Pull Requests to merge into main.
If you get a merge conflict, don't randomly delete code — ask the relevant teammate.
Keep main stable and working.
🎯 Our Final Architecture
                         CIVIC ISSUE TRACKER
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                 FRONTEND                    BACKEND
                 F1 + F2                    B1 + B2
                    │                           │
              React + Leaflet             FastAPI + Python
              Tailwind CSS                    │
                    │                    ┌─────┴─────┐
                    │                    │           │
                    │                 PostGIS       H3
                    │                    │           │
                    └────────────────────┼───────────┘
                                         ↓
                                  PostgreSQL
                                         │
                                  DATABASE TEAM
                                      D1 + D2

Everyone works on their own branch → pushes their work → creates a Pull Request → reviews → merges into main.