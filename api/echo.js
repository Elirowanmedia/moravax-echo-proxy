// api/echo.js
export default async function handler(req, res) {
  try {
    const API = process.env.API_DATA_GOV_KEY;
    if (!API) {
      return res.status(500).json({ ok: false, error: 'Missing env API_DATA_GOV_KEY' });
    }

    // Accept either:
    //  (A) source=frs & path=<frs path> (default path = v3/facilities)
    //      plus any FRS query params (state_code, pagesize, etc.)
    //  (B) url=<full https URL>  (safe-listed hosts only)
    const { source, path, url, ...rest } = req.query;

    let target = '';
    const qs = new URLSearchParams(rest);

    if (source === 'frs') {
      // Default to the modern FRS v3 facilities endpoint
      const rel = (path && typeof path === 'string') ? path : 'v3/facilities';
      // Add API key
      qs.set('api_key', API);
      target = `https://api.epa.gov/frs/${rel}?${qs.toString()}`;
    } else if (url) {
      // Very small allow-list for pass-through mode
      const allowed = ['api.epa.gov', 'echo.epa.gov', 'enviro.epa.gov'];
      const u = new URL(url);
      if (!allowed.includes(u.hostname)) {
        return res.status(400).json({ ok: false, error: 'Host not allowed in pass-through url' });
      }
      // If caller didn’t include api_key and host is api.epa.gov, add it
      if (u.hostname === 'api.epa.gov' && !u.searchParams.get('api_key')) {
        u.searchParams.set('api_key', API);
      }
      target = u.toString();
    } else {
      return res.status(400).json({ ok: false, error: 'Specify source=frs (preferred) or url=<https URL>' });
    }

    const upstream = await fetch(target, { headers: { 'Accept': 'application/json' } });
    const text = await upstream.text();
    let body;

    try { body = JSON.parse(text); }
    catch { body = text; } // if upstream didn’t send JSON

    return res.status(upstream.status).json({ ok: upstream.ok, status: upstream.status, body });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
