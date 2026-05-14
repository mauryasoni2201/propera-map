import React, { useState } from 'react';
import Gate from './components/Gate';
import FlyoverMap from './components/FlyoverMap';
import './App.css';

const ENV_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

function App() {
  const [token, setToken] = useState(ENV_TOKEN || null);

  if (!token) return <Gate onLaunch={setToken} />;
  return <FlyoverMap token={token} />;
}

export default App;
