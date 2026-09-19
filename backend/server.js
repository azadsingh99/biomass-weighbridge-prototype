const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();
const port = Number(process.env.PORT || 4000);
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname) || '.jpg'}`)
  }),
  limits: { files: 5, fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
});

app.use(cors());
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/analyze', upload.array('images', 5), async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Upload at least one image.' });
  const supplierId = req.body.supplierId || 'UNKNOWN_SUPPLIER';
  const captureId = req.body.captureId || crypto.randomUUID();
  try {
    const images = files.map((file) => ({
      mimeType: file.mimetype,
      base64: fs.readFileSync(file.path).toString('base64')
    }));
    const result = await analyze(images, supplierId, captureId);
    res.json({ message: 'Analysis complete', captureId, supplierId, result });
  } catch (error) {
    res.status(500).json({ error: 'Image analysis failed.', details: error.message });
  } finally {
    files.forEach((file) => fs.rm(file.path, { force: true }, () => {}));
  }
});

async function analyze(images, supplierId, captureId) {
  if ((process.env.USE_MOCK_GEMINI || 'true').toLowerCase() === 'true') {
    return {
      moisture_pct: Number((18 + images.length * 2.5).toFixed(1)),
      ash_pct: 7.3,
      foreign_stones_present: false,
      confidence: 0.92,
      analysis: `Mock Gemini analysis of ${images.length} image(s). No likely foreign stones detected.`,
      model: 'mock', supplierId, captureId
    };
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is required when USE_MOCK_GEMINI=false.');
  const prompt = `You inspect biomass at a weighbridge. Analyze these images and return JSON only with moisture_pct, ash_pct, foreign_stones_present, confidence, and analysis.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, ...images.map((image) => ({ inline_data: { mime_type: image.mimeType, data: image.base64 } }))] }] })
  });
  if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}: ${await response.text()}`);
  const body = await response.json();
  const text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '{}';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}') + 1;
  return { ...JSON.parse(text.slice(start, end)), model: 'gemini-2.0-flash', supplierId, captureId };
}

app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
