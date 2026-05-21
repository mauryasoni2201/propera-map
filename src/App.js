import React, { useState, lazy, Suspense } from 'react';
import Gate from './components/Gate';
import './App.css';

// Defer the 3 MB mapbox-gl bundle until after the user authenticates.
const FlyoverMap = lazy(() => import('./components/FlyoverMap'));

const ENV_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

function App() {
  const [token, setToken] = useState(ENV_TOKEN || null);

  if (!token) return <Gate onLaunch={setToken} />;
  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#000' }} />}>
      <FlyoverMap token={token} />
    </Suspense>
  );
}

export default App;
