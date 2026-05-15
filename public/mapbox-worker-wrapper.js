const _warn = self.console.warn.bind(self.console);
self.console.warn = function (...args) {
  if (typeof args[0] === 'string' && (
    args[0].includes('Ignoring unknown image variable') ||
    args[0].includes('Cutoff is currently disabled on terrain')
  )) return;
  _warn(...args);
};

importScripts('./mapbox-gl-csp-worker.js');
