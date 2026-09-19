# Biomass Weighbridge Prototype

Minimal end-to-end prototype for a factory weighbridge inspection workflow.

## What is implemented

- React/Vite mobile-friendly upload UI supporting up to 5 images.
- Browser-side validation for image type/count/size.
- Express backend with server-side multipart validation.
- Gemini API key stays only on the backend in `backend/.env`.
- Gemini call uses a dedicated system instruction and JSON response mode.
- Mock Gemini mode works without external credentials.
- PostgreSQL schema and backend persistence for supplier, images, AI response, predictions and delayed lab results.
- Health endpoint reports application and database availability.
- README documents the production strategy for interrupted 15MB mobile uploads.

## Local setup

Requirements: Node.js 18+ and PostgreSQL.

### 1. Database

Create a PostgreSQL database, for example:

```bash
createdb biomass_weighbridge
psql biomass_weighbridge < database/schema.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Set `DATABASE_URL` in `backend/.env`. For a no-key local demo, keep:

```env
USE_MOCK_GEMINI=true
```

For real Gemini:

```env
USE_MOCK_GEMINI=false
GEMINI_API_KEY=your_key
```

The key is never included in frontend code, browser storage, or API responses.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## API

### `GET /api/health`

Returns backend and database health.

### `POST /api/analyze`

Multipart form data:

- `images`: 1–5 image files
- `supplierId`: required supplier identifier
- `captureId`: optional UUID used as an idempotency/correlation identifier

Response contains:

- moisture percentage
- ash percentage
- foreign-stone detection
- confidence
- model name
- persisted inspection ID when PostgreSQL is configured

## Architecture

```text
Mobile browser
    |
    | HTTPS multipart upload
    v
Node/Express API
    |-- validate files + metadata
    |-- persist inspection
    |-- build server-side Gemini request
    v
Google Gemini API
    |
    v
AI JSON result
    |
    +--> PostgreSQL
    |     supplier + image refs + raw AI JSON
    |     + delayed physical lab result
    |
    +--> API response --> Mobile browser
```

## 15MB upload on unstable 3G/4G/5G

The prototype deliberately does **not** analyze until the complete multipart request has arrived. A dropped connection therefore produces no partial AI result.

For production, the upload should move to a resumable object-storage flow:

1. Browser requests an upload session and receives a stable `captureId`.
2. Each photo is uploaded in resumable chunks with `Content-Range`/chunk numbers and a checksum.
3. The backend/object store records received chunks and lets the browser retry only the missing ranges after reconnecting.
4. Once all 5 files are complete, the backend verifies checksums, marks the capture finalized, and enqueues analysis.
5. A worker calls Gemini with server-side credentials and writes the result using `captureId` as an idempotency key.
6. The UI polls or receives a push update for completion.

This avoids restarting a 15MB upload after every network interruption, prevents duplicate analyses, and keeps incomplete captures from entering the AI pipeline.

For a production deployment I would use object storage (such as Google Cloud Storage) with resumable uploads, a queue/worker, request authentication, rate limiting, malware/content validation, structured logging, retries with backoff, and encrypted storage.

## Database and delayed lab calibration

`biomass_inspections.physical_lab_result` is nullable because laboratory measurements arrive later. When the lab result arrives, store it with `lab_result_received_at`; offline jobs can then compare the AI prediction against the physical result to measure drift and calibrate future models.

This repository is intentionally lightweight for the interview exercise; deployment infrastructure and authentication are described but not required for the local prototype.
