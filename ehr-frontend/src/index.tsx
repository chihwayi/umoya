import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

// Suppress specific console messages to clean up development environment
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;

const ignoredMessages = [
  'Download the React DevTools',
  'run localStorage.setItem("debug", "cornerstoneTools")'
];

function shouldIgnore(args: any[]) {
  if (args.length === 0) return false;
  const msg = typeof args[0] === 'string' ? args[0] : '';
  return ignoredMessages.some(ignored => msg.toLowerCase().includes(ignored.toLowerCase()));
}

console.log = (...args) => {
  if (!shouldIgnore(args)) originalConsoleLog(...args);
};

console.info = (...args) => {
  if (!shouldIgnore(args)) originalConsoleInfo(...args);
};

console.warn = (...args) => {
  if (!shouldIgnore(args)) originalConsoleWarn(...args);
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);