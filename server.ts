import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyKl_Rx_xLs3dzNkNb_Fosf0txpebqEyQtA1QyAXgrKTWZFIV7n3BreSZe8dNWdwgQI2w/exec';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Centralized Google Apps Script proxy endpoint
  app.all('/api/gas', async (req, res) => {
    try {
      if (req.method === 'GET') {
        const query = new URLSearchParams(req.query as Record<string, string>).toString();
        const targetUrl = query ? `${GAS_URL}?${query}` : GAS_URL;
        const response = await fetch(targetUrl, {
          method: 'GET',
          redirect: 'follow',
        });
        const data = await response.json();
        return res.json(data);
      }

      if (req.method === 'POST') {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
          redirect: 'follow',
        });
        const data = await response.json();
        return res.json(data);
      }

      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al comunicarse con Apps Script';
      console.error('[GAS Proxy Error]:', errorMessage);
      return res.status(502).json({
        ok: false,
        error: `Error de proxy con Google Apps Script: ${errorMessage}`,
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} [${isProd ? 'production' : 'development'}]`);
  });
}

startServer();
