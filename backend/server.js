const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = Number(process.env.PORT || 4000);
const maxFileSize = Number(process.env.UPLOAD_MAX_MB || 25) * 1024 * 1024;
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname) || '.jpg'}`)
  }),
  limits: { files: 5, fileSize: maxFileSize },
  fileFilter: (_req, file, cb) => cb(null, /^image\\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype))
});

app.use(cors({ origin: corsOrigin }));
app.get('/api/health', async (_req, res) => {
  let database = 'not_configured';
  if (pool) {
    try {
      await pool.query('SELECT 1');
      database = 'ok';
    } catch {
      database = 'error';
    }
  }
  res.json({ status: 'ok', database });
});

app.post('/api/analyze', upload.array('images', 5), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Upload 1 to 5 images.' });

  const supplierId = String(req.body.supplierId || '').trim();
  const captureId = String(req.body.captureId || crypto.randomUUID()).trim();

  if (!supplierId) return cleanupAndRespond(res, files, 400, { error: 'supplierId is required.' });

  try {
    const images = files.map((file) => ({
      mimeType: file.mimetype,
      base64: fs.readFileSync(file.path).toString('base64')
    }));

    const result = await analyze(images, supplierId, captureId);
    const inspectionId = await persistInspection({
      supplierId,
      captureId,
      imageReference: JSON.stringify(files.map((file) => ({
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: path.basename(file.path)
      }))),
      result
    });

    res.status(201).json({
      message: 'Analysis complete',
      inspectionId,
      captureId,
      supplierId,
      result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Image analysis failed.' });
  } finally {
    files.forEach((file) => fs.rm(file.path, { force: true }, () => {}));
  }
});

async function persistInspection({ supplierId, captureId, imageReference, result }) {
  if (!pool) return null;

  await pool.query(
    `INSERT INTO suppliers (supplier_id)
     VALUES ($1)
     ON CONFLICT (supplier_id) DO NOTHING`,
    [supplierId]
  );

  const { rows } = await pool.query(
    `INSERT INTO biomass_inspections
      (supplier_id, capture_id, image_reference, api_response,
       moisture_pct, ash_pct, foreign_stones_present, ai_confidence, model_name)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      supplierId,
      captureId,
      imageReference,
      JSON.stringify(result),
      result.moisture_pct ?? null,
      result.ash_pct ?? null,
      result.foreign_stones_present ?? null,
      result.confidence ?? null,
      result.model ?? null
    ]
  );

  return rows[0].id;
}

async function analyze(images, supplierId, captureId) {
  if ((process.env.USE_MOCK_GEMINI || 'true').toLowerCase() === 'true') {
    return {
      moisture_pct: Number((18 + images.length * 2.5).toFixed(1)),
      ash_pct: 7.3,
      foreign_stones_present: false,
      confidence: 0.92,
      analysis: `Mock Gemini analysis of ${images.length} image(s). Set USE_MOCK_GEMINI=false to call Gemini.`,
      model: 'mock',
      supplierId,
      captureId
    };
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is required when USE_MOCK_GEMINI=false.');

  const systemPrompt = [
    'You are a biomass quality inspector assisting a factory weighbridge.',
    'Analyze all supplied truckload images together.',
    'Estimate moisture percentage and ash percentage from visible material characteristics.',
    'Detect whether foreign stones are present.',
    'Do not invent measurements that cannot be reasonably inferred from images.',
    'Return JSON only with exactly these fields:',
    '{ "moisture_pct": number, "ash_pct": number, "foreign_stones_present": boolean, "confidence": number, "analysis": string }',
    'confidence must be between 0 and 1.'
  ].join(' ');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          role: 'user',
          parts: [
            { text: `Supplier: ${supplierId}. Capture: ${captureId}. Analyze this truckload.` },
            ...images.map((image) => ({
              inline_data: { mime_type: image.mimeType, data: image.base64 }
            }))
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini returned HTTP ${response.status}: ${await response.text()}`);
  }

  const body = await response.json();
  const text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  const result = JSON.parse(text);

  if (
    typeof result.moisture_pct !== 'number' ||
    typeof result.ash_pct !== 'number' ||
    typeof result.foreign_stones_present !== 'boolean' ||
    typeof result.confidence !== 'number'
  ) {
    throw new Error('Gemini returned an invalid response shape.');
  }

  return { ...result, model: 'gemini-2.0-flash', supplierId, captureId };
}

function cleanupAndRespond(res, files, status, body) {
  files.forEach((file) => fs.rm(file.path, { force: true }, () => {}));
  return res.status(status).json(body);
}

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Each image must be within the upload size limit.' });
    if (error.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: 'Maximum 5 images are allowed.' });
  }
  if (error) return res.status(400).json({ error: error.message || 'Invalid upload.' });
});

app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
