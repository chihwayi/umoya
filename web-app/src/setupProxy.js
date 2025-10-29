const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy API requests to tenant-service
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://tenant-service:3001',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.log('Proxy error:', err.message);
      }
    })
  );
};
