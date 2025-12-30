
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createServer } from 'http';
import { parse } from 'url';
import startResearch from './api/start-research';
import items from './api/items';
import status from './api/status';
// import approve from './api/approve'; // Uncomment if needed

// Helper to parse body
const getBody = (req) => new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            resolve(body ? JSON.parse(body) : {});
        } catch (e) {
            resolve({});
        }
    });
});

// Mock Vercel Response
const createResponse = (res) => {
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
        return res;
    };
    return res;
};

const server = createServer(async (req, res) => {
    const wrappedRes = createResponse(res);
    const parsedUrl = parse(req.url || '', true);
    const { pathname, query } = parsedUrl;

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

server.listen(3002, () => {
    console.log('Local API Server running on http://localhost:3002');
});
