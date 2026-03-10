const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy Terminology API requests to ehr-service
  app.use(
    '/api/terminology',
    createProxyMiddleware({
      target: process.env.EHR_SERVICE_URL || 'http://ehr-service:3013',
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
      target: process.env.EHR_SERVICE_URL || 'http://ehr-service:3013',
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
      target: process.env.CDSS_SERVICE_URL || 'http://cdss-service:8000',
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
      target: process.env.PROXY_TARGET || 'http://tenant-service:3001',
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
