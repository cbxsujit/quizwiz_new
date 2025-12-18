import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode is temporarily removed to prevent double-initialization of PeerJS 
  // in development which can cause ID conflicts or connection issues during testing.
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);