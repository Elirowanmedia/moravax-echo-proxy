// File: api/echo.js
// A tiny CORS-friendly proxy for EPA ECHO.
// Reads API key from env (API_DATA_GOV_KEY) and forwards query params.

export default async function handler(req, res) {
  // Basic CORS (and preflight) so GitHub Pages / Carrd can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Allow a quick health check
    if (req.query.ping) {
      res.status(200).json({ ok: true, message: 'echo proxy alive' });
      return;
    }

    // Which ECHO endpoint? default to the cross-program "facility info"
    const endpoint = (req.query.endpoint || 'rest_services.get_facility_info').toString();

    // Base ECHO host (documented under "ECHO Web Services")
    const base = 'https://echodata.epa.gov/echo';

    // Build a clean query string from the incoming params (except endpoint)
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === 'endpoint' || k === 'ping') continue;
      if (Array.isArray(v)) v.forEach(val => params.append(k, val));
      else params.append(k, v);
    }

    // Always inject your api.data.gov key
    const apiKey = process.env.API_DATA_GOV_KEY;
    if (!apiKey) {
      res.status(500).json({ ok: false, error: 'Missing env API_DATA_GOV_KEY' });
      return;
    }
    if (!params.has('api_key')) params.append('api_key', apiKey);

    // Default to JSON unless the caller asked for something else
    if (!params.has('output')) params.append('output', 'JSON');

    const url = `${base}/${endpoint}?${params.toString()}`;

    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const contentType = r.headers.get('content-type') || '';
    const status = r.status;

    if (!r.ok) {
      const text = await r.text();
      res.status(status).json({ ok: false, status, body: text });
      return;
    }

    if (contentType.includes('application/json')) {
      const json = await r.json();
      res.status(status).json(json);
    } else {
      // Rare, but if ECHO returns text/HTML, forward as text
      const text = await r.text();
      res.status(status).send(text);
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || String(err) });
  }
} 
