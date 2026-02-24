import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5173;

// Proxy API calls to backend
app.use('/api', createProxyMiddleware({
  target: 'http://127.0.0.1:3001/api',
  changeOrigin: true
}));

// Proxy uploads to backend
app.use('/uploads', createProxyMiddleware({
  target: 'http://127.0.0.1:3001/uploads',
  changeOrigin: true
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Read index.html into memory
const indexHtml = readFileSync(path.join(__dirname, 'dist', 'index.html'), 'utf-8');

// Handle React Router - catch all remaining GET routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.setHeader('Content-Type', 'text/html');
    res.send(indexHtml);
  } else {
    next();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
