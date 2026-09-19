import { useState } from 'react';

const MAX_IMAGES = 5;
const MAX_MB = 25;

export default function App() {
  const [supplierId, setSupplierId] = useState('SUP-1024');
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function onFilesChange(event) {
    const selected = Array.from(event.target.files || []);
    const valid = selected.filter((file) => file.type.startsWith('image/') && file.size <= MAX_MB * 1024 * 1024).slice(0, MAX_IMAGES);
    setFiles(valid);
    setResult(null);
    setError(selected.length !== valid.length
      ? `Select up to ${MAX_IMAGES} images. Each image must be under ${MAX_MB}MB.`
      : '');
  }

  async function submit(event) {
    event.preventDefault();
    if (!supplierId.trim()) return setError('Supplier ID is required.');
    if (!files.length) return setError('Select at least one image.');

    const form = new FormData();
    const captureId = crypto.randomUUID();
    files.forEach((file) => form.append('images', file));
    form.append('supplierId', supplierId.trim());
    form.append('captureId', captureId);

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/analyze', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Request failed');
      setResult(body);
    } catch (err) {
      setError(navigator.onLine === false
        ? 'Network connection dropped. Keep the selected photos and retry when online.'
        : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ fontFamily: 'Arial', maxWidth: 720, margin: '40px auto', padding: 20 }}>
      <h1>Biomass Weighbridge Inspection</h1>
      <p>Capture up to 5 truckload photos and send them to the secure backend for analysis.</p>

      <form onSubmit={submit}>
        <label>
          Supplier ID<br />
          <input value={supplierId} onChange={(e) => setSupplierId(e.target.value)} />
        </label>

        <br /><br />

        <label>
          Photos (1–5)<br />
          <input type="file" accept="image/*" multiple capture="environment" onChange={onFilesChange} />
        </label>

        <br /><br />

        <button disabled={loading}>
          {loading ? 'Analyzing...' : 'Analyze Images'}
        </button>
      </form>

      {files.length > 0 && (
        <p>{files.length} image(s) selected. Total: {(files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)}MB.</p>
      )}

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {result && (
        <section>
          <h2>Inspection Result</h2>
          <p>Moisture: <strong>{result.result.moisture_pct}%</strong></p>
          <p>Ash: <strong>{result.result.ash_pct}%</strong></p>
          <p>Foreign stones: <strong>{result.result.foreign_stones_present ? 'Present' : 'Not detected'}</strong></p>
          <p>Confidence: <strong>{Math.round(result.result.confidence * 100)}%</strong></p>
          <p>{result.result.analysis}</p>
          <details>
            <summary>Raw response</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  );
}
