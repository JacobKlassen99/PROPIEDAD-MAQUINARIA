const GAS_URL = 'https://script.google.com/macros/s/AKfycbyKl_Rx_xLs3dzNkNb_Fosf0txpebqEyQtA1QyAXgrKTWZFIV7n3BreSZe8dNWdwgQI2w/exec';

export default async (req: Request) => {
  const method = req.method.toUpperCase();

  try {
    if (method === 'GET') {
      const url = new URL(req.url);
      const target = url.search ? `${GAS_URL}${url.search}` : GAS_URL;
      const resp = await fetch(target, { method: 'GET', redirect: 'follow' });
      const data = await resp.text();
      return new Response(data, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (method === 'POST') {
      const body = await req.text();
      const resp = await fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body,
        redirect: 'follow',
      });
      const data = await resp.text();
      return new Response(data, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Netlify GAS Proxy Error: ${errorMsg}`,
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
