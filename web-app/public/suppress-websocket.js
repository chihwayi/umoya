// Suppress WebSocket connection errors in console
(function() {
  const originalError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('WebSocket connection') || 
        message.includes('ws://localhost') || 
        message.includes('was interrupted while the page was loading')) {
      return; // Suppress WebSocket errors
    }
    originalError.apply(console, args);
  };
})();