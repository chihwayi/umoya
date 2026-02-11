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
