const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const port = Number(process.env.PORT || 3011);
const buildDir = path.resolve(__dirname, '..', 'build');
const indexFile = path.join(buildDir, 'index.html');
const tenantApiBase = process.env.TENANT_SERVICE_URL || process.env.SERVICE_TENANT_URL || 'http://tenant-service:3001';
const ehrApiBase = process.env.EHR_SERVICE_URL || process.env.SERVICE_EHR_URL || 'http://ehr-service:3013';
const cdssApiBase = process.env.CDSS_SERVICE_URL || process.env.SERVICE_CDSS_URL || 'http://cdss-service:8000';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function respondFile(targetFile, res, statusCode = 200) {
  fs.readFile(targetFile, (error, data) => {
    if (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
      return;
    }

    const ext = path.extname(targetFile).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(statusCode, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function resolveProxyTarget(urlPath) {
  if (urlPath.startsWith('/api/cdss-admin')) {
    return {
      base: cdssApiBase,
      path: urlPath.replace(/^\/api\/cdss-admin/, '') || '/',
    };
  }

  if (urlPath.startsWith('/api/terminology') || urlPath.startsWith('/api/dhis2')) {
    return {
      base: ehrApiBase,
      path: urlPath,
    };
  }

  if (urlPath.startsWith('/api')) {
    return {
      base: tenantApiBase,
      path: urlPath,
    };
  }

  return null;
}

function proxyRequest(req, res, targetBase, targetPath) {
  let target;
  try {
    target = new URL(targetBase);
  } catch (error) {
    sendJson(res, 500, { message: `Invalid proxy target: ${targetBase}` });
    return;
  }

  const transport = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers };
  headers.host = target.host;

  const retryableMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  const retryableErrors = new Set(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND', 'ETIMEDOUT']);
  const maxAttempts = retryableMethods.has(String(req.method || '').toUpperCase()) ? 2 : 1;

  const forward = (attempt) => {
    const proxyReq = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        method: req.method,
        path: targetPath,
        headers,
      },
      (proxyRes) => {
        const responseHeaders = { ...proxyRes.headers };
        if (responseHeaders['transfer-encoding']) {
          delete responseHeaders['transfer-encoding'];
        }
        res.writeHead(proxyRes.statusCode || 502, responseHeaders);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (error) => {
      if (attempt < maxAttempts && retryableErrors.has(error.code)) {
        setTimeout(() => forward(attempt + 1), 150);
        return;
      }

      sendJson(res, 502, {
        message: `Proxy error: ${error.message}`,
        target: targetBase,
        path: targetPath,
        attempt,
      });
    });

    if (retryableMethods.has(String(req.method || '').toUpperCase())) {
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
  };

  forward(1);
}

const server = http.createServer((req, res) => {
  const method = String(req.method || 'GET').toUpperCase();
  const rawUrl = req.url || '/';
  const urlPath = decodeURIComponent(rawUrl.split('?')[0]);
  const proxyTarget = resolveProxyTarget(urlPath);

  if (proxyTarget) {
    const targetPath = `${proxyTarget.path}${rawUrl.includes('?') ? `?${rawUrl.split('?').slice(1).join('?')}` : ''}`;
    proxyRequest(req, res, proxyTarget.base, targetPath);
    return;
  }

  if (!['GET', 'HEAD'].includes(method)) {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method not allowed');
    return;
  }

  const requestPath = decodeURIComponent(rawUrl.split('?')[0]);
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(buildDir, safePath);

  if (!filePath.startsWith(buildDir)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      respondFile(filePath, res);
      return;
    }

    if (!error && stats.isDirectory()) {
      const nestedIndex = path.join(filePath, 'index.html');
      fs.stat(nestedIndex, (nestedErr, nestedStats) => {
        if (!nestedErr && nestedStats.isFile()) {
          respondFile(nestedIndex, res);
          return;
        }
        respondFile(indexFile, res);
      });
      return;
    }

    respondFile(indexFile, res);
  });
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`@umoya/web-app serving build on port ${port}`);
});
