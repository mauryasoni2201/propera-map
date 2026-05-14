import React, { useState } from 'react';

function Gate({ onLaunch }) {
  const [input, setInput] = useState('');

  const handleLaunch = () => {
    const tok = input.trim();
    if (!tok || !tok.startsWith('pk.')) {
      alert('Please enter a valid Mapbox public token (starts with pk.)');
      return;
    }
    onLaunch(tok);
  };

  return (
    <div id="gate">
      <div className="gc">
        <div className="gc-brand">
          <div className="plogo">PROPER<span className="pdot">A</span><span className="pai">.AI</span></div>
        </div>
        <h2>UK Cinematic Flyover</h2>
        <div className="sub">Mapbox GL JS v3 · Lighting API · 8 Cities · 30+ Landmarks</div>
        <div className="info">
          Uses <strong style={{ color: '#e8c98e' }}>Mapbox Standard Style</strong> with the v3 Lighting API —
          dynamic shadows, ambient + directional lights, landmark 3D buildings, film grain &amp; cinematic grading.
          <br /><br />
          <b style={{ color: '#e8c98e' }}>Get a free token:</b> Sign up at{' '}
          <a href="https://account.mapbox.com" target="_blank" rel="noreferrer">account.mapbox.com</a>
          {' '}and copy your Default public token (<code style={{ color: '#c8a96e' }}>pk.…</code>).
          The free tier covers thousands of map loads/month.
        </div>
        <div className="irow">
          <input
            type="text"
            placeholder="pk.eyJ1…your Mapbox public token"
            spellCheck="false"
            autoComplete="off"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLaunch(); }}
          />
          <button className="launch" onClick={handleLaunch}>Launch ▶</button>
        </div>
        <div className="note">Token stays in this browser tab only — never transmitted elsewhere.</div>
      </div>
    </div>
  );
}

export default Gate;
