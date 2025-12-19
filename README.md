# Confirming Bankinter Web App

## Setup

1. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Docker**:
   ```bash
   docker-compose up --build
   ```

## Stack
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Frontend: React + Vite, TailwindCSS
