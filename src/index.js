import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const _consoleWarn = console.warn.bind(console);
console.warn = function (...args) {
  if (typeof args[0] === 'string' && args[0].includes('Cutoff is currently disabled on terrain')) return;
  _consoleWarn(...args);
};

if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
}

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(<App />);
