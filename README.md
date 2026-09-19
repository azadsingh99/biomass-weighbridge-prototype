# Biomass Weighbridge Prototype

Minimal end-to-end prototype for factory biomass inspection.

## Included

- React/Vite frontend for uploading up to 5 images.
- Express backend with multipart upload validation.
- Mock Gemini mode enabled by default.
- Optional live Gemini REST API integration.
- PostgreSQL schema for supplier, image reference, AI JSON, and delayed lab results.
- Resilience guidance for interrupted mobile uploads.

## Run locally

Requirements: Node.js 18+.

Terminal 1:

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, select one or more images, and click **Analyze Images**.

The default backend mode is mock mode, so no Gemini key is needed:

```env
USE_MOCK_GEMINI=true
```

For live Gemini, set `USE_MOCK_GEMINI=false` and provide `GEMINI_API_KEY` in `backend/.env`. The key is never sent to the browser.

## API

`POST /api/analyze` accepts multipart form data:

- `images`: up to 5 image files
- `supplierId`: supplier identifier
- `captureId`: optional idempotency/capture identifier

`GET /api/health` checks backend availability.

## Example mock response

```json
{
  "message": "Analysis complete",
  "supplierId": "SUP-1024",
  "result": {
    "moisture_pct": 20.5,
    "ash_pct": 7.3,
    "foreign_stones_present": false,
    "confidence": 0.92,
    "model": "mock"
  }
}
```

## Resilience for a 15MB upload on an unstable network

The current prototype rejects incomplete requests safely and does not analyze until all multipart files arrive. For production, the client should split files into chunks and retry them using a stable `captureId` and chunk number. The backend should persist upload status, support byte-range resume, use idempotency keys, and finalize the inspection only after every chunk is present. Temporary files should be stored in object storage, and a queue should perform analysis after finalization. This prevents partial uploads, duplicate analysis, and lost work when 3G/4G/5G drops.

## Database

Apply `database/schema.sql` to PostgreSQL. The `physical_lab_result` JSONB field is intentionally nullable so delayed lab measurements can later be compared with AI predictions for calibration.

This is a functional prototype, not a production deployment; authentication, object storage, resumable uploads, rate limiting, and a background queue should be added before deployment.
