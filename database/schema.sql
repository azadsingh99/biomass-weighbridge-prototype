import { useState } from 'react';

const initialResult = null;

export default function App() {
  const [supplierId, setSupplierId] = useState('SUP-1024');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(initialResult);

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files.slice(0, 5));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFiles.length) {
      setError('Please choose up to 5 images before submitting.');
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append('images', file));
    formData.append('supplierId', supplierId);
    formData.append('captureId', crypto.randomUUID());

    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Upload failed.');
      }

      setResult(payload.result);
    } catch (submitError) {
      setError(submitError.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 800, margin: '40px auto', padding: 20 }}>
      <h1>Biomass Weighbridge Inspection</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="supplierId">Supplier ID</label>
          <br />
          <input
            id="supplierId"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 6 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label htmlFor="images">Upload biomass images (up to 5)</label>
          <br />
          <input
            id="images"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            style={{ marginTop: 6 }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ padding: '10px 18px', cursor: 'pointer' }}>
          {loading ? 'Analyzing...' : 'Analyze Images'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 16, color: 'crimson', background: '#ffe6e6', padding: 12 }}>
          {error}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <strong>Selected files:</strong>
          <ul>
            {selectedFiles.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 24, background: '#f6f8fa', padding: 16, borderRadius: 8 }}>
          <h2>Inspection Result</h2>
          <p><strong>Moisture:</strong> {result.moisture_pct}%</p>
          <p><strong>Ash:</strong> {result.ash_pct}%</p>
          <p><strong>Foreign stones present:</strong> {String(result.foreign_stones_present)}</p>
          <p><strong>Confidence:</strong> {(result.confidence * 100).toFixed(0)}%</p>
          <p><strong>Analysis:</strong> {result.analysis}</p>
          <p><strong>Model:</strong> {result.model}</p>
        </div>
      )}
    </div>
  );
}
