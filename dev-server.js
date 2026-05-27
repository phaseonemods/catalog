#!/usr/bin/env node
/**
 * dev-server.js
 * Local development server for the catalog dev tool.
 *
 * Usage:
 *   node dev-server.js [port]          (default port 3333)
 *
 * Endpoints:
 *   GET  /                          → serves dev-tool.html
 *   GET  /api/read-catalog          → returns catalog.js as plain text
 *   POST /api/write-catalog         → writes { code } to catalog.js
 *   POST /api/publish               → runs "netlify deploy --build --prod"
 *                                     and streams output via SSE
 */

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const { spawn, execSync } = require('child_process');

// ─── Config ──────────────────────────────────────────────────
const PORT         = parseInt(process.argv[2]) || 3333;
const PROJECT_ROOT = __dirname;                          // same folder as this script
const CATALOG_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'catalog.js');
const DEVTOOL_PATH = path.join(PROJECT_ROOT, 'dev-tool.html');

// ─── Helpers ─────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, code, obj) {
  cors(res);
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ─── Server ──────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url    = req.url.split('?')[0];
  const method = req.method.toUpperCase();

  // Preflight
  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ── GET / → dev tool HTML ─────────────────────────────────
  if (method === 'GET' && url === '/') {
    if (!fs.existsSync(DEVTOOL_PATH)) {
      res.writeHead(404); res.end('dev-tool.html not found'); return;
    }
    cors(res);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(DEVTOOL_PATH, 'utf8'));
    return;
  }

  // ── GET /api/read-catalog ─────────────────────────────────
  if (method === 'GET' && url === '/api/read-catalog') {
    if (!fs.existsSync(CATALOG_PATH)) {
      json(res, 404, { error: `catalog.js not found at ${CATALOG_PATH}` }); return;
    }
    json(res, 200, { code: fs.readFileSync(CATALOG_PATH, 'utf8') });
    return;
  }

  // ── POST /api/write-catalog ───────────────────────────────
  if (method === 'POST' && url === '/api/write-catalog') {
    try {
      const { code } = await readBody(req);
      if (typeof code !== 'string') throw new Error('"code" must be a string');

      // Ensure parent dir exists
      fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });

      // Atomic write: temp file → rename
      const tmp = CATALOG_PATH + '.tmp';
      fs.writeFileSync(tmp, code, 'utf8');
      fs.renameSync(tmp, CATALOG_PATH);

      json(res, 200, { ok: true, path: CATALOG_PATH });
    } catch (err) {
      json(res, 400, { error: err.message });
    }
    return;
  }

  // ── POST /api/publish → SSE stream of netlify output ─────
  if (method === 'POST' && url === '/api/publish') {
    cors(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });

    const send = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    send('info', `► Running: netlify deploy --build --prod`);
    send('info', `► Working directory: ${PROJECT_ROOT}`);

    // Check netlify is accessible
    const whichResult = (() => {
      try {
        return execSync('which netlify || npx netlify --version', { cwd: PROJECT_ROOT, timeout: 5000 }).toString().trim();
      } catch { return null; }
    })();

    if (!whichResult) {
      send('error', 'netlify CLI not found. Install it: npm install -g netlify-cli');
      send('done', '1');
      res.end();
      return;
    }

    // Determine command: prefer global netlify, fall back to npx
    const useNpx    = !whichResult.includes('/');
    const cmd       = useNpx ? 'npx' : 'netlify';
    const args      = useNpx
      ? ['netlify', 'deploy', '--build', '--prod']
      : ['deploy', '--build', '--prod'];

    const child = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      shell: true,
    });

    child.stdout.on('data', chunk => send('stdout', chunk.toString()));
    child.stderr.on('data', chunk => send('stderr', chunk.toString()));

    child.on('close', code => {
      send(code === 0 ? 'success' : 'error',
           code === 0 ? 'Deploy finished successfully!' : `Process exited with code ${code}`);
      send('done', String(code));
      res.end();
    });

    child.on('error', err => {
      send('error', `Spawn error: ${err.message}`);
      send('done', '1');
      res.end();
    });

    req.on('close', () => { try { child.kill(); } catch {} });
    return;
  }

  // ── POST /api/publish-github → SSE stream of git + deploy output ─────
  if (method === 'POST' && url === '/api/publish-github') {
    cors(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    });

    let body = {};
    try { body = await readBody(req); } catch {}

    // commitMessage is passed as an array arg — no shell escaping needed
    const commitMessage = (body.commitMessage || 'chore: update catalog');

    const send = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    send('info', `► Running: git add · git commit · git push · npm run deploy`);
    send('info', `► Working directory: ${PROJECT_ROOT}`);

    // Check git is available
    try { execSync('git --version', { cwd: PROJECT_ROOT, timeout: 5000 }); }
    catch {
      send('error', 'git not found. Make sure git is installed and in your PATH.');
      send('done', '1');
      res.end();
      return;
    }

    // Run steps sequentially — avoids all shell quoting issues on Windows
    const steps = [
      { cmd: 'git', args: ['add', '-A'] },
      { cmd: 'git', args: ['commit', '-m', commitMessage] },
      { cmd: 'git', args: ['push', 'origin', 'main'] },
      { cmd: 'npm', args: ['run', 'deploy'] },
    ];

    let aborted = false;
    req.on('close', () => { aborted = true; });

    function runStep(i) {
      if (aborted) return;
      if (i >= steps.length) {
        send('success', '✓ Committed, pushed, and deployed successfully!');
        send('done', '0');
        res.end();
        return;
      }

      const { cmd, args } = steps[i];
      send('info', `► ${cmd} ${args.join(' ')}`);

      const child = spawn(cmd, args, {
        cwd: PROJECT_ROOT,
        env: { ...process.env },
        shell: true,   // needed on Windows so git/npm resolve from PATH
      });

      child.stdout.on('data', chunk => send('stdout', chunk.toString()));
      child.stderr.on('data', chunk => send('stderr', chunk.toString()));

      child.on('close', code => {
        if (aborted) return;

        // git commit exits 1 when there's nothing new to commit — treat as non-fatal
        if (code !== 0 && i === 1) {
          send('stderr', `Nothing new to commit (exit ${code}) — continuing with push…`);
          runStep(i + 1);
          return;
        }

        if (code !== 0) {
          send('error', `"${cmd} ${args.join(' ')}" failed with exit code ${code}`);
          send('done', String(code));
          res.end();
          return;
        }

        runStep(i + 1);
      });

      child.on('error', err => {
        send('error', `Spawn error on "${cmd}": ${err.message}`);
        send('done', '1');
        res.end();
      });
    }

    runStep(0);
    return;
  }

  // ── 404 ───────────────────────────────────────────────────
  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║   Catalog Dev Server running               ║`);
  console.log(`║   http://localhost:${PORT}                   ║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);
  console.log(`catalog.js path: ${CATALOG_PATH}`);
  console.log(`Press Ctrl+C to stop.\n`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: node dev-server.js ${PORT + 1}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
