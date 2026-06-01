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

module.exports = function setupProxy(app) {
  const tenantServiceUrl = requireUrl(
    'Tenant service proxy target',
    resolveUrl(
      process.env.TENANT_SERVICE_URL || process.env.SERVICE_TENANT_URL || 'http://tenant-service:3001',
      process.env.SERVICE_BASE_URL,
      process.env.SERVICE_TENANT_PATH || '/tenant-service',
    ),
  );

  const ehrServiceUrl = requireUrl(
    'EHR service proxy target',
    resolveUrl(
      process.env.EHR_SERVICE_URL || process.env.SERVICE_EHR_URL || 'http://ehr-service:3013',
      process.env.SERVICE_BASE_URL,
      process.env.SERVICE_EHR_PATH || '/ehr-service',
    ),
  );

  const cdssServiceUrl = requireUrl(
    'CDSS service proxy target',
    resolveUrl(
      process.env.CDSS_SERVICE_URL || process.env.SERVICE_CDSS_URL || 'http://cdss-service:8000',
      process.env.SERVICE_BASE_URL,
      process.env.SERVICE_CDSS_PATH || '/cdss-service',
    ),
  );

  app.use(
    '/tenant-service',
    createProxyMiddleware({
      target: tenantServiceUrl,
      changeOrigin: true,
      secure: false,
      logLevel: 'silent',
      pathRewrite: {
        '^/tenant-service': '',
      },
    }),
  );

  app.use(
    '/ehr-service',
    createProxyMiddleware({
      target: ehrServiceUrl,
      changeOrigin: true,
      secure: false,
      logLevel: 'silent',
      pathRewrite: {
        '^/ehr-service': '',
      },
    }),
  );

  // CDSS enforces service-to-service auth. The browser can't hold the service
  // secret, so the proxy (server-side) injects the static service token. CDSS runs
  // SERVICE_AUTH_MODE=both, so x-service-token satisfies auth; X-Tenant-ID is sent
  // by the client. The token stays server-side and is never exposed to the browser.
  const cdssServiceToken = trim(process.env.CDSS_SERVICE_TOKEN);

  app.use(
    '/cdss-service',
    createProxyMiddleware({
      target: cdssServiceUrl,
      changeOrigin: true,
      secure: false,
      logLevel: 'silent',
      pathRewrite: {
        '^/cdss-service': '',
      },
      onProxyReq: (proxyReq) => {
        if (cdssServiceToken) {
          proxyReq.setHeader('x-service-token', cdssServiceToken);
        }
      },
    }),
  );
};
