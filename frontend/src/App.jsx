import { useState } from 'react';
export default function App() {
  const [supplierId, setSupplierId] = useState('SUP-1024');
  const [files, setFiles] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!files.length) return setError('Select at least one image.');
    const form = new FormData();
    files.forEach((file) => form.append('images', file));
    form.append('supplierId', supplierId);
    form.append('captureId', crypto.randomUUID());
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Request failed');
      setResult(body);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <main style={{ fontFamily: 'Arial', maxWidth: 720, margin: '40px auto', padding: 20 }}>
    <h1>Biomass Weighbridge Inspection</h1>
    <form onSubmit={submit}>
      <label>Supplier ID<br/><input value={supplierId} onChange={(e) => setSupplierId(e.target.value)} /></label><br/><br/>
      <label>Photos (up to 5)<br/><input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}/></label><br/><br/>
      <button disabled={loading}>{loading ? 'Analyzing...' : 'Analyze Images'}</button>
    </form>
    {files.length > 0 && <p>{files.length} image(s) selected.</p>}
    {error && <p style={{ color: 'crimson' }}>{error}</p>}
    {result && <section><h2>Inspection Result</h2><pre>{JSON.stringify(result, null, 2)}</pre></section>}
  </main>;
}
