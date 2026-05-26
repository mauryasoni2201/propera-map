import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl/dist/mapbox-gl-csp';
import 'mapbox-gl/dist/mapbox-gl.css';
import { CHAPTERS, SCENES, SCENE_CHAPTER, LIGHT_CFG, PRESET_META } from '../data/flyoverData';

mapboxgl.workerUrl = process.env.PUBLIC_URL + '/mapbox-worker-wrapper.js';

// Smooth cubic ease-in-out — symmetric, cinematic camera feel
const cinEase = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Preload a photo so it's in browser cache before the camera arrives
function preloadPhoto(url) {
  if (!url) return;
  const img = new Image();
  img.src = url;
}

function FlyoverMap({ token }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);

  // Playback state
  const curRef          = useRef(0);
  const playingRef      = useRef(true);
  const spdRef          = useRef(1);
  const sceneVersionRef = useRef(0); // incremented each scheduleScene call; stale callbacks bail out

  // Timers
  const holdTimerRef    = useRef(null);
  const labelTimerRef   = useRef(null);
  const photoTimerRef   = useRef(null);

  // Particles
  const particlesRafRef    = useRef(null);
  const particlesResizeRef = useRef(null);
  const particlesStartRef  = useRef(null);
  const particlesStopRef   = useRef(null);

  // DOM refs — map UI
  const fadeRef        = useRef(null);
  const introRef       = useRef(null);
  const chapterElRef   = useRef(null);
  const chNumRef       = useRef(null);
  const chCityRef      = useRef(null);
  const chTaglineRef   = useRef(null);
  const lblRef         = useRef(null);
  const ltRef          = useRef(null);
  const lsRef          = useRef(null);
  const hcityRef       = useRef(null);
  const haRef          = useRef(null);
  const hposRef        = useRef(null);
  const lbadgeRef      = useRef(null);
  const lbIconRef      = useRef(null);
  const lbNameRef      = useRef(null);
  const chromaRef      = useRef(null);
  const pfilRef        = useRef(null);
  const chapnavRef     = useRef(null);
  const sdotsRef       = useRef(null);
  const logoRevealRef  = useRef(null);
  const particlesRef   = useRef(null);
  const bplayRef       = useRef(null);
  const skyRef         = useRef(null);
  const photoOverlayRef = useRef(null);
  const photoImgRef     = useRef(null);
  const photoCreditRef  = useRef(null);
  const manualPresetRef = useRef('day');

  // Forward-declare for mutual recursion
  const scheduleSceneRef = useRef(null);
  const goToSceneRef     = useRef(null);

  // ── helpers ──────────────────────────────────────────────────────────────

  function applyLights(preset) {
    if (!mapRef.current) return;
    const p   = manualPresetRef.current || preset;
    const cfg = LIGHT_CFG[p] || LIGHT_CFG.day;
    mapRef.current.setConfigProperty('basemap', 'lightPreset', p);
    try {
      mapRef.current.setLights([
        { id: 'ambient-light',     type: 'ambient',     properties: { color: cfg.amb.color, intensity: cfg.amb.intensity } },
        { id: 'directional-light', type: 'directional', properties: { color: cfg.dir.color, intensity: cfg.dir.intensity, direction: cfg.dir.direction, 'cast-shadows': cfg.dir.shadows, 'shadow-intensity': cfg.dir.si } }
      ]);
    } catch (e) { console.warn('setLights:', e.message); }
    const meta = PRESET_META[p] || PRESET_META.day;
    if (lbIconRef.current) lbIconRef.current.textContent = meta.icon;
    if (lbNameRef.current) lbNameRef.current.textContent = meta.label;
    document.querySelectorAll('.lpill').forEach(pill =>
      pill.classList.toggle('on', pill.dataset.preset === p)
    );
  }

  function chromaFlash() {
    const el = chromaRef.current;
    if (!el) return;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 160);
  }

  function startProgress(dur) {
    const f = pfilRef.current;
    if (!f) return;
    f.style.transition = 'none';
    f.style.width = '0%';
    void f.offsetWidth; // force reflow
    f.style.transition = `width ${dur}ms linear`;
    f.style.width = '100%';
  }

  function stopProgress() {
    const f = pfilRef.current;
    if (!f) return;
    f.style.transition = 'none';
    f.style.width = '0%';
  }

  function refreshUI(i) {
    if (sdotsRef.current)
      sdotsRef.current.querySelectorAll('.sdot').forEach((d, j) => d.classList.toggle('on', j === i));

    const ci = SCENE_CHAPTER[i];
    if (chapnavRef.current) {
      chapnavRef.current.querySelectorAll('.cnav-item').forEach((el, j) => {
        el.classList.toggle('on', j === ci);
        el.querySelector('.cnav-dot').classList.toggle('on', j === ci);
      });
    }
    const sc = SCENES[i];
    if (hcityRef.current) hcityRef.current.textContent = CHAPTERS[ci].name;
    if (haRef.current)    haRef.current.textContent    = 'Altitude  ' + sc.altFt.toLocaleString() + ' ft';
    const lat = sc.center[1].toFixed(4);
    const lng = Math.abs(sc.center[0]).toFixed(4);
    const ld  = sc.center[0] < 0 ? 'W' : 'E';
    if (hposRef.current) hposRef.current.textContent = lat + '° N  ·  ' + lng + '° ' + ld;
  }

  function showLabel(sc) {
    const el = lblRef.current;
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => {
      if (ltRef.current) ltRef.current.textContent = sc.name;
      if (lsRef.current) lsRef.current.textContent = sc.sub;
      el.classList.add('show');
    }, 50);
  }

  function showChapterCard(chapterIdx, cb) {
    const ch = CHAPTERS[chapterIdx];
    const el = chapterElRef.current;
    if (chNumRef.current)    chNumRef.current.textContent    = ch.num;
    if (chCityRef.current)   chCityRef.current.textContent   = ch.name;
    if (chTaglineRef.current) chTaglineRef.current.textContent = ch.tagline;
    if (el) el.classList.add('show');
    setTimeout(() => {
      if (el) el.classList.remove('show');
      setTimeout(cb || function () {}, 600);
    }, 2400);
  }

  function showLogoReveal() {
    stopProgress();
    playingRef.current = false;
    const bplay = bplayRef.current;
    if (bplay) { bplay.innerHTML = '&#9654;'; bplay.classList.remove('on'); }
    if (particlesRef.current) particlesRef.current.classList.add('show');
    particlesStartRef.current?.();
    setTimeout(() => {
      if (logoRevealRef.current) logoRevealRef.current.classList.add('show');
    }, 800);
  }

  // ── photo overlay ─────────────────────────────────────────────────────────

  function showPhoto(sc, version) {
    if (version !== sceneVersionRef.current) return;
    const overlay = photoOverlayRef.current;
    const img     = photoImgRef.current;
    const credit  = photoCreditRef.current;
    if (!overlay || !img || !sc.photo) return;

    // Reset Ken Burns by removing + re-adding the animation
    img.style.animation = 'none';
    void img.offsetWidth; // reflow triggers restart
    img.style.animation = '';

    img.src = sc.photo;
    overlay.classList.remove('fast');
    overlay.classList.add('show');
    if (credit) {
      credit.textContent = sc.credit || '';
      if (sc.credit) {
        credit.classList.add('show');
      } else {
        credit.classList.remove('show');
      }
    }
  }

  function hidePhoto(immediate) {
    if (photoTimerRef.current) { clearTimeout(photoTimerRef.current); photoTimerRef.current = null; }
    const overlay = photoOverlayRef.current;
    const credit  = photoCreditRef.current;
    const img     = photoImgRef.current;
    if (!overlay) return;
    if (immediate) {
      overlay.classList.add('fast');
    } else {
      overlay.classList.remove('fast');
    }
    overlay.classList.remove('show');
    if (credit) credit.classList.remove('show');
    // Clear old image so it doesn't flash when the next scene fades in
    if (img) img.removeAttribute('src');
  }

  // ── scene sequencer ───────────────────────────────────────────────────────

  function scheduleScene(i) {
    if (holdTimerRef.current)  { clearTimeout(holdTimerRef.current);  holdTimerRef.current  = null; }
    if (labelTimerRef.current) { clearTimeout(labelTimerRef.current); labelTimerRef.current = null; }

    // Stamp this scene; any callback that sees a different stamp is stale
    const version = ++sceneVersionRef.current;
    curRef.current = i;

    const sc      = SCENES[i];
    const flyDur  = Math.round(sc.duration / spdRef.current);
    const holdDur = Math.round(sc.holdMs   / spdRef.current);
    const totalDur = flyDur + holdDur;

    if (!manualPresetRef.current) applyLights(sc.lightPreset);

    // Hide photo for the flight; restore 3D buildings
    hidePhoto(true);
    if (lblRef.current) lblRef.current.classList.remove('show');

    const m = mapRef.current;
    if (m) {
      m.setConfigProperty('basemap', 'show3dObjects', true);
      m.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
      m.setConfigProperty('basemap', 'showPlaceLabels', false);
      m.setConfigProperty('basemap', 'showRoadLabels', false);
      m.setConfigProperty('basemap', 'showTransitLabels', false);
      // Restore buildings to full opacity for 3D flight phase
      if (m.getLayer('propera-buildings')) {
        m.setPaintProperty('propera-buildings', 'fill-extrusion-opacity-transition', { duration: 400, delay: 0 });
        m.setPaintProperty('propera-buildings', 'fill-extrusion-opacity', 0.85);
      }
    }

    // Cinematic flyTo with smooth cubic ease
    m.flyTo({
      center:  sc.center,
      zoom:    sc.zoom,
      pitch:   sc.pitch,
      bearing: sc.bearing,
      duration: flyDur,
      easing:  cinEase
    });

    // Show label partway through the flight
    labelTimerRef.current = setTimeout(() => {
      labelTimerRef.current = null;
      if (version !== sceneVersionRef.current) return;
      showLabel(sc);
    }, Math.round(flyDur * 0.2));

    // When camera arrives: wait a beat for tiles to settle, then crossfade to photo
    const onMoveEnd = () => {
      if (version !== sceneVersionRef.current) return;
      photoTimerRef.current = setTimeout(() => {
        photoTimerRef.current = null;
        showPhoto(sc, version);
        // Gently soften 3D buildings under the photo
        if (m && m.getLayer('propera-buildings')) {
          m.setPaintProperty('propera-buildings', 'fill-extrusion-opacity-transition', { duration: 1200, delay: 400 });
          m.setPaintProperty('propera-buildings', 'fill-extrusion-opacity', 0);
        }
      }, 350);
    };
    m.once('moveend', onMoveEnd);

    // Preload the NEXT scene's photo during hold so it's cached and instant
    const nextI = (i + 1) % SCENES.length;
    const nextPhoto = SCENES[nextI]?.photo;
    if (nextPhoto) setTimeout(() => preloadPhoto(nextPhoto), Math.round(holdDur * 0.3));

    startProgress(totalDur);

    if (playingRef.current) {
      holdTimerRef.current = setTimeout(() => {
        if (version !== sceneVersionRef.current) return;
        holdTimerRef.current = null;
        const next = (i + 1) % SCENES.length;
        if (next === 0) {
          showLogoReveal();
        } else {
          const prevChap = SCENE_CHAPTER[i];
          const nextChap = SCENE_CHAPTER[next];
          if (nextChap !== prevChap) {
            stopProgress();
            chromaFlash();
            showChapterCard(nextChap, () => goToSceneRef.current(next, false));
          } else {
            goToSceneRef.current(next, false);
          }
        }
      }, totalDur);
    }
  }

  function goToScene(i, manual) {
    if (holdTimerRef.current)  { clearTimeout(holdTimerRef.current);  holdTimerRef.current  = null; }
    if (labelTimerRef.current) { clearTimeout(labelTimerRef.current); labelTimerRef.current = null; }
    if (lblRef.current) lblRef.current.classList.remove('show');
    hidePhoto(true);
    stopProgress();
    // Stop any in-progress camera move cleanly
    if (mapRef.current) mapRef.current.stop();
    const prevChap = SCENE_CHAPTER[curRef.current];
    const newChap  = SCENE_CHAPTER[i];
    refreshUI(i);
    chromaFlash();
    if (manual && newChap !== prevChap) {
      showChapterCard(newChap, () => scheduleSceneRef.current(i));
    } else {
      scheduleSceneRef.current(i);
    }
  }

  scheduleSceneRef.current = scheduleScene;
  goToSceneRef.current     = goToScene;

  function setPlay(v) {
    playingRef.current = v;
    const btn = bplayRef.current;
    if (btn) { btn.innerHTML = v ? '&#9646;&#9646;' : '&#9654;'; btn.classList.toggle('on', v); }
    if (v) {
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      scheduleSceneRef.current(curRef.current);
    } else {
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
      stopProgress();
      if (mapRef.current) mapRef.current.stop();
    }
  }

  function skipChapter(dir) {
    const curChap    = SCENE_CHAPTER[curRef.current];
    const targetChap = (curChap + dir + CHAPTERS.length) % CHAPTERS.length;
    const firstIdx   = SCENES.findIndex((_, si) => SCENE_CHAPTER[si] === targetChap);
    if (firstIdx >= 0) goToScene(firstIdx, true);
  }

  function restartFlyover() {
    if (logoRevealRef.current)  logoRevealRef.current.classList.remove('show');
    if (particlesRef.current)   particlesRef.current.classList.remove('show');
    particlesStopRef.current?.();
    playingRef.current = true;
    const bplay = bplayRef.current;
    if (bplay) { bplay.innerHTML = '&#9646;&#9646;'; bplay.classList.add('on'); }
    goToScene(0, true);
  }

  function initParticles() {
    const canvas = particlesRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let active = false;

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    particlesResizeRef.current = resize;
    window.addEventListener('resize', resize);

    function spawn() {
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * canvas.width, y: Math.random() * canvas.height,
          r: Math.random() * 1.5 + 0.3,   vx: (Math.random() - 0.5) * 0.3,
          vy: -(Math.random() * 0.6 + 0.15), alpha: Math.random() * 0.6 + 0.1,
          life: Math.random() * 200 + 100
        });
      }
    }

    function draw() {
      if (!active) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,169,110,${p.alpha * (p.life / 300)})`;
        ctx.fill();
        p.x += p.vx; p.y += p.vy; p.life--;
        if (p.life <= 0) {
          particles.splice(idx, 1);
          particles.push({
            x: Math.random() * canvas.width, y: canvas.height + 10,
            r: Math.random() * 1.5 + 0.3,   vx: (Math.random() - 0.5) * 0.3,
            vy: -(Math.random() * 0.6 + 0.2), alpha: Math.random() * 0.5 + 0.15,
            life: Math.random() * 200 + 120
          });
        }
      });
      particlesRafRef.current = requestAnimationFrame(draw);
    }

    spawn();
    particlesStartRef.current = () => { if (!active) { active = true; draw(); } };
    particlesStopRef.current  = () => {
      active = false;
      if (particlesRafRef.current) { cancelAnimationFrame(particlesRafRef.current); particlesRafRef.current = null; }
    };
  }

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container:         mapContainerRef.current,
      style:             'mapbox://styles/mapbox/standard',
      center:            SCENES[0].center,
      zoom:              SCENES[0].zoom,
      pitch:             SCENES[0].pitch,
      bearing:           SCENES[0].bearing,
      antialias:         true,
      maxPitch:          85,
      interactive:       false,
      renderWorldCopies: false,
      fadeDuration:      0,   // instant tile appearance, eliminates tile-fade jitter
    });
    mapRef.current = map;

    // Chapter nav
    const nav = chapnavRef.current;
    CHAPTERS.forEach((ch, i) => {
      const item = document.createElement('div');
      item.className = 'cnav-item' + (i === 0 ? ' on' : '');
      item.dataset.chapter = i;
      item.innerHTML = `<span class="cnav-label">${ch.name}</span><span class="cnav-dot${i === 0 ? ' on' : ''}"></span>`;
      item.addEventListener('click', () => {
        const firstIdx = SCENES.findIndex((_, si) => SCENE_CHAPTER[si] === i);
        if (firstIdx >= 0) goToSceneRef.current(firstIdx, true);
      });
      nav.appendChild(item);
    });

    // Scene dots
    const dotsEl = sdotsRef.current;
    SCENES.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'sdot' + (i === 0 ? ' on' : '');
      d.addEventListener('click', () => goToSceneRef.current(i, true));
      dotsEl.appendChild(d);
    });

    initParticles();

    // Preload the first two photos immediately
    preloadPhoto(SCENES[0]?.photo);
    preloadPhoto(SCENES[1]?.photo);

    map.on('style.load', () => {
      map.setConfigProperty('basemap', 'show3dObjects', true);
      map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
      map.setConfigProperty('basemap', 'showPlaceLabels', false);
      map.setConfigProperty('basemap', 'showRoadLabels', false);
      map.setConfigProperty('basemap', 'showTransitLabels', false);
      map.setConfigProperty('basemap', 'lightPreset', SCENES[0].lightPreset);

      const addBuildingLayer = () => {
        if (!map.getSource('composite') || map.getLayer('propera-buildings')) return;
        map.addLayer({
          id: 'propera-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'height'],
              0, '#d8d2c8', 20, '#c6bfb5', 50, '#a89e94', 100, '#8a8078', 200, '#6c6460', 350, '#4e4a46'],
            'fill-extrusion-height':  ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['get', 'height']],
            'fill-extrusion-base':    ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['get', 'min_height']],
            'fill-extrusion-opacity': 0.85,
            'fill-extrusion-emissive-strength': 0.18,
            'fill-extrusion-ambient-occlusion-intensity':   0.55,
            'fill-extrusion-ambient-occlusion-radius':      7,
            'fill-extrusion-ambient-occlusion-wall-radius': 7,
            'fill-extrusion-flood-light-color':              '#c8a96e',
            'fill-extrusion-flood-light-intensity':          0.18,
            'fill-extrusion-flood-light-wall-radius':        8,
            'fill-extrusion-flood-light-ground-attenuation': 0.75
          }
        });
      };

      addBuildingLayer();
      if (!map.getLayer('propera-buildings')) map.once('idle', addBuildingLayer);

      applyLights(SCENES[0].lightPreset);

      // Intro sequence
      setTimeout(() => {
        const intro = introRef.current;
        if (intro) intro.classList.add('show');
        setTimeout(() => {
          if (intro) intro.classList.remove('show');
          if (fadeRef.current) fadeRef.current.classList.add('clear');
          setTimeout(() => {
            if (lbadgeRef.current) lbadgeRef.current.classList.add('show');
            showChapterCard(0, () => {
              refreshUI(0);
              if (playingRef.current) scheduleSceneRef.current(0);
            });
          }, 1000);
        }, 3500);
      }, 700);
    });

    map.on('error', e => console.warn('[Mapbox]', e.error?.message || e));

    const onKey = e => {
      if (!mapRef.current) return;
      if (e.key === ' ')            { e.preventDefault(); setPlay(!playingRef.current); }
      else if (e.key === 'ArrowRight') goToSceneRef.current((curRef.current + 1) % SCENES.length, true);
      else if (e.key === 'ArrowLeft')  goToSceneRef.current((curRef.current - 1 + SCENES.length) % SCENES.length, true);
      else if (e.key === ']') skipChapter(1);
      else if (e.key === '[') skipChapter(-1);
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      if (holdTimerRef.current)  clearTimeout(holdTimerRef.current);
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
      if (photoTimerRef.current) clearTimeout(photoTimerRef.current);
      particlesStopRef.current?.();
      if (particlesResizeRef.current) window.removeEventListener('resize', particlesResizeRef.current);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      <div ref={mapContainerRef} id="map" />
      <div ref={skyRef} id="sky-overlay" />

      {/* Cinematic photo overlay — shown when camera arrives at a location */}
      <div ref={photoOverlayRef} id="photo-overlay">
        <img
          ref={photoImgRef}
          alt=""
          onError={() => {
            // If photo fails to load, hide the overlay gracefully
            if (photoOverlayRef.current) photoOverlayRef.current.classList.remove('show');
          }}
        />
      </div>

      <canvas ref={particlesRef} id="particles" />
      <div id="grain" />
      <div className="bar top" />
      <div className="bar bot" />
      <div id="vig" />
      <div ref={chromaRef} id="chroma" />
      <div ref={fadeRef} id="fade" />

      <div ref={introRef} id="intro">
        <div className="brand">PROPER<span>A</span>.AI</div>
        <div className="divider" />
        <div className="byline">The Future of UK Property Intelligence</div>
      </div>

      <div ref={chapterElRef} id="chapter">
        <div ref={chNumRef} className="ch-num">Chapter I</div>
        <div ref={chCityRef} className="ch-city">London</div>
        <div ref={chTaglineRef} className="ch-tagline">Global Finance · Heritage · Innovation</div>
        <div className="ch-line" />
      </div>

      <div ref={lblRef} id="lbl">
        <span ref={ltRef} className="lt" />
        <span ref={lsRef} className="ls" />
      </div>

      <div id="hud">
        <div ref={hcityRef} className="hgold">London</div>
        <div ref={haRef}    className="hv">Altitude — ft</div>
        <div ref={hposRef}  className="hc" />
      </div>

      <div ref={lbadgeRef} id="lbadge">
        <span ref={lbIconRef} className="lb-icon">☀️</span>
        <span ref={lbNameRef} className="lb-name">Dawn</span>
      </div>

      <div ref={chapnavRef} id="chapnav" />

      <div id="lpills">
        <button className="lpill on" data-preset="day">☀ Day</button>
      </div>

      <div ref={sdotsRef} id="sdots" />
      <div id="pbar"><div ref={pfilRef} id="pfil" /></div>

      <div ref={photoCreditRef} id="photo-credit" />

      <div id="ctrl">
        <button className="cb" title="Previous ←"
          onClick={() => goToScene((curRef.current - 1 + SCENES.length) % SCENES.length, true)}>&#8592;</button>
        <button ref={bplayRef} className="cb on" title="Play / Pause  Space"
          onClick={() => setPlay(!playingRef.current)}>&#9646;&#9646;</button>
        <button className="cb" title="Next →"
          onClick={() => goToScene((curRef.current + 1) % SCENES.length, true)}>&#8594;</button>
        <button className="cb-skip" onClick={() => skipChapter(1)}>Chapter ▶</button>
        <select id="spd" defaultValue="1" onChange={e => {
          spdRef.current = parseFloat(e.target.value);
          if (mapRef.current && playingRef.current) {
            if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
            scheduleSceneRef.current(curRef.current);
          }
        }}>
          <option value="0.4">0.4×</option>
          <option value="0.6">0.6×</option>
          <option value="1">1×</option>
          <option value="1.5">1.5×</option>
        </select>
      </div>

      <div ref={logoRevealRef} id="logo-reveal">
        <div className="lr-pre">Powered by</div>
        <div className="lr-logo">PROPER<span>A</span>.AI</div>
        <div className="lr-line" />
        <div className="lr-tag">UK Property Intelligence · Built on Real Estate Data</div>
        <button className="lr-restart" onClick={restartFlyover}>↺ Watch Again</button>
      </div>
    </>
  );
}

export default FlyoverMap;
