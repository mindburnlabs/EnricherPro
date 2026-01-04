import { config } from 'dotenv';
config({ path: '.env.local' });
import { createServer } from 'http';

import startResearch from './api/start-research';
import items from './api/items';
import jobs from './api/jobs';
import audit from './api/audit';
import status from './api/status';
// import approve from './api/approve'; // Uncomment if needed

// Helper to parse body
const getBody = (req: any) =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });

// Mock Vercel Response
const createResponse = (res: any) => {
  res.status = (code: any) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
};

import deepHealth from './api/health/deep';

const server = createServer(async (req, res) => {
  const wrappedRes = createResponse(res);
  const baseURL = `http://${req.headers.host || 'localhost'}`;
  const parsedUrl = new URL(req.url || '', baseURL);
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams);

  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  console.log(`${req.method} ${pathname}`);

  try {
    if (pathname === '/api/start-research' && req.method === 'POST') {
      const body = await getBody(req);
      (req as any).body = body;
      await startResearch(req as any, wrappedRes as any);
    } else if (pathname === '/api/items' && req.method === 'GET') {
      (req as any).query = query;
      await items(req as any, wrappedRes as any);
    } else if (pathname === '/api/jobs' && req.method === 'GET') {
      (req as any).query = query;
      await jobs(req as any, wrappedRes as any);
    } else if (pathname === '/api/audit' && req.method === 'GET') {
      (req as any).query = query;
      await audit(req as any, wrappedRes as any);
    } else if (pathname === '/api/health/deep' && req.method === 'GET') {
      await deepHealth(req as any, wrappedRes as any);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(e) }));
  }
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Local API Server running on http://localhost:${PORT}`);
});
