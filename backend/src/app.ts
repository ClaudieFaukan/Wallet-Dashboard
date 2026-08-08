import express from 'express';

export function createApp() {
  const app = express();

  app.get('/api/v1/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  });

  return app;
}
