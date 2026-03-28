const { createProxyMiddleware } = require('http-proxy-middleware');

const trim = (value) => String(value || '').trim();
const stripTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');
const ensureLeadingSlash = (value) => {
  const normalized = trim(value);
  if (!normalized) return '/';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};
const joinUrl = (base, path) => `${stripTrailingSlash(base)}${ensureLeadingSlash(path)}`;

const resolveUrl = (explicitValue, inheritedBase, inheritedPath) => {
  const explicit = trim(explicitValue);
  if (explicit) return explicit;
  const base = trim(inheritedBase);
  if (!base) return '';
  return joinUrl(base, inheritedPath);
};

const requireUrl = (label, value) => {
  const resolved = trim(value);
  if (!resolved) {
    throw new Error(`${label} is not configured. Set SERVICE_BASE_URL or explicit service URL environment variables.`);
  }
  return resolved;
};

module.exports = function(app) {
  const ehrServiceUrl = requireUrl(
    'EHR service proxy target',
    resolveUrl(
      process.env.EHR_SERVICE_URL || process.env.SERVICE_EHR_URL,
      process.env.SERVICE_BASE_URL,
      process.env.SERVICE_EHR_PATH || '/ehr-service',
    ),
  );
  const cdssServiceUrl = requireUrl(
    'CDSS service proxy target',
    resolveUrl(
      process.env.CDSS_SERVICE_URL || process.env.SERVICE_CDSS_URL,
      process.env.SERVICE_BASE_URL,
      process.env.SERVICE_CDSS_PATH || '/cdss-service',
    ),
  );
  const tenantServiceUrl = requireUrl(
    'Tenant service proxy target',
    resolveUrl(
      process.env.PROXY_TARGET || process.env.TENANT_SERVICE_URL || process.env.SERVICE_TENANT_URL,
      process.env.SERVICE_BASE_URL,
      process.env.SERVICE_TENANT_PATH || '/tenant-service',
    ),
  );

  // Proxy Terminology API requests to ehr-service
  app.use(
    '/api/terminology',
    createProxyMiddleware({
      target: ehrServiceUrl,
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.error('EHR Proxy error:', err.message);
        res.status(502).send('Proxy Error: ' + err.message);
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying terminology request:', req.method, req.url, '->', proxyReq.path);
      }
    })
  );

  // Proxy DHIS2 API requests to ehr-service
  app.use(
    '/api/dhis2',
    createProxyMiddleware({
      target: ehrServiceUrl,
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.error('DHIS2 Proxy error:', err.message);
        res.status(502).send('Proxy Error: ' + err.message);
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying DHIS2 request:', req.method, req.url, '->', proxyReq.path);
      }
    })
  );

  // Proxy CDSS Admin requests to cdss-service
  app.use(
    '/api/cdss-admin',
    createProxyMiddleware({
      target: cdssServiceUrl,
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      pathRewrite: {
        '^/api/cdss-admin': '',
      },
      onError: (err, req, res) => {
        console.error('CDSS Admin Proxy error:', err.message);
        res.status(502).send('Proxy Error: ' + err.message);
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying CDSS admin request:', req.method, req.url, '->', proxyReq.path);
      }
    })
  );

  // Proxy API requests to tenant-service
  app.use(
    '/api',
    createProxyMiddleware({
      target: tenantServiceUrl,
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.error('Tenant Proxy error:', err.message);
        res.status(502).send('Proxy Error: ' + err.message);
      }
    })
  );
};
