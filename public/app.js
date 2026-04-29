let onlineProfiles  = {};
let localVoices     = {};
let currentMode     = 'online';   // 'online' | 'local'
let selectedProfile = 'narrator'; // online profile key
let selectedVoice   = 'am_michael'; // local voice key
let localModelReady = false;
let currentJobId    = null;
let pollTimer       = null;

const STATUSES_ONLINE = [
  'Connecting to voice servers...',
  'Sending script to neural engine...',
  'Synthesising audio...',
  'Processing voice data...',
  'Finalising...',
  'Almost done...'
];
const STATUSES_LOCAL = [
  'Loading local voice model...',
  'Running Kokoro engine...',
  'Generating audio offline...',
  'Writing audio file...',
  'Almost done...'
];

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  const [profilesRes, localRes, statusRes] = await Promise.all([
    fetch('/profiles'),
    fetch('/local-voices'),
    fetch('/local-status')
  ]);
  onlineProfiles  = await profilesRes.json();
  localVoices     = await localRes.json();
  const status    = await statusRes.json();
  localModelReady = status.ready;

  renderOnlineProfiles();
  renderLocalVoices();
  setupDropZone();
  document.getElementById('script-text').addEventListener('input', updateCharCount);
}

// ── Mode Toggle ───────────────────────────────────────────────────────────────

function switchMode(mode) {
  currentMode = mode;

  document.getElementById('mode-online').classList.toggle('active', mode === 'online');
  document.getElementById('mode-local').classList.toggle('active', mode === 'local');
  document.getElementById('online-section').style.display = mode === 'online' ? 'block' : 'none';
  document.getElementById('local-section').style.display  = mode === 'local'  ? 'block' : 'none';

  document.getElementById('voice-section-title').textContent =
    mode === 'online' ? 'Voice Profile' : 'Choose a Character';

  // Pitch slider: online only
  const pitchSlider = document.getElementById('slider-pitch');
  const pitchLabel  = document.getElementById('pitch-label');
  const pitchVal    = document.getElementById('pitch-val');
  const pitchNote   = document.getElementById('pitch-local-note');
  pitchSlider.disabled = mode === 'local';
  pitchLabel.classList.toggle('disabled', mode === 'local');
  pitchVal.classList.toggle('disabled', mode === 'local');
  pitchNote.classList.toggle('visible', mode === 'local');

  // Local model warning
  const warn = document.getElementById('local-unavailable');
  warn.classList.toggle('visible', mode === 'local' && !localModelReady);

  // Set sensible defaults per mode
  if (mode === 'online') {
    const p = onlineProfiles[selectedProfile];
    if (p) applyDefaults(p.defaults.rate, p.defaults.volume, p.defaults.pitch);
  } else {
    applyDefaults('-5%', '+15%', '+5Hz');
  }
}

function applyDefaults(rate, volume, pitch) {
  const speed = parseInt(rate);
  const vol   = parseInt(volume);
  const pit   = parseInt(pitch);
  document.getElementById('slider-speed').value  = speed;
  document.getElementById('slider-volume').value = vol;
  document.getElementById('slider-pitch').value  = pit;
  updateSlider('speed',  speed);
  updateSlider('volume', vol);
  updateSlider('pitch',  pit);
}

// ── Online Profiles ───────────────────────────────────────────────────────────

function renderOnlineProfiles() {
  const grid = document.getElementById('profiles-grid');
  grid.innerHTML = '';
  Object.entries(onlineProfiles).forEach(([key, p]) => {
    const card = document.createElement('div');
    card.className = 'profile-card' + (key === selectedProfile ? ' selected' : '');
    card.onclick = () => selectOnlineProfile(key);
    card.innerHTML = `
      <div class="profile-name">${p.label}</div>
      <div class="profile-sub">${p.subtitle}</div>
      <div class="profile-desc">${p.description}</div>
      <div class="traits">${p.traits.map(t => `<span class="trait">${t}</span>`).join('')}</div>
    `;
    grid.appendChild(card);
  });
}

function selectOnlineProfile(key) {
  selectedProfile = key;
  document.querySelectorAll('.profile-card').forEach((c, i) => {
    c.classList.toggle('selected', Object.keys(onlineProfiles)[i] === key);
  });
  const p = onlineProfiles[key];
  if (p?.defaults) applyDefaults(p.defaults.rate, p.defaults.volume, p.defaults.pitch);
}

// ── Local Voices ──────────────────────────────────────────────────────────────

function renderLocalVoices() {
  const wrap = document.getElementById('local-grid-wrap');
  wrap.innerHTML = '';

  // Group by the 'group' field
  const groups = {};
  Object.entries(localVoices).forEach(([id, v]) => {
    if (!groups[v.group]) groups[v.group] = [];
    groups[v.group].push({ id, ...v });
  });

  Object.entries(groups).forEach(([groupName, voices]) => {
    const label = document.createElement('div');
    label.className = 'local-group-label';
    label.textContent = groupName;
    wrap.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'local-voices-grid';

    voices.forEach(v => {
      const card = document.createElement('div');
      card.className = 'local-card' + (v.id === selectedVoice ? ' selected' : '');
      card.id = `lc-${v.id}`;
      card.onclick = () => selectLocalVoice(v.id);
      card.innerHTML = `
        <div class="local-card-name">${v.name}</div>
        <div class="local-card-style">${v.style}</div>
      `;
      grid.appendChild(card);
    });

    wrap.appendChild(grid);
  });
}

function selectLocalVoice(id) {
  selectedVoice = id;
  document.querySelectorAll('.local-card').forEach(c => {
    c.classList.toggle('selected', c.id === `lc-${id}`);
  });
}

// ── Sliders ───────────────────────────────────────────────────────────────────

function updateSlider(type, val) {
  val = parseInt(val);
  const el = document.getElementById(`${type}-val`);
  if (type === 'speed')       el.textContent = val > 0 ? `+${val}%` : `${val}%`;
  else if (type === 'volume') el.textContent = `+${val}%`;
  else                        el.textContent = val >= 0 ? `+${val}Hz` : `${val}Hz`;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  const isPaste = tab === 'paste';
  document.getElementById('tab-paste').classList.toggle('active', isPaste);
  document.getElementById('tab-upload').classList.toggle('active', !isPaste);
  document.getElementById('script-text').style.display = isPaste ? 'block' : 'none';
  document.getElementById('drop-zone').style.display   = isPaste ? 'none'  : 'block';
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────

function setupDropZone() {
  const zone  = document.getElementById('drop-zone');
  const input = document.getElementById('file-input');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  });
  input.addEventListener('change', () => { if (input.files[0]) readFile(input.files[0]); });
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('script-text').value = e.target.result.trim();
    updateCharCount();
    switchTab('paste');
  };
  reader.readAsText(file);
}

function updateCharCount() {
  document.getElementById('char-count').textContent =
    document.getElementById('script-text').value.length.toLocaleString();
}

// ── Generate ──────────────────────────────────────────────────────────────────

async function generate() {
  const text = document.getElementById('script-text').value.trim();
  if (!text) { showError('Please paste or upload your script first.'); return; }
  if (currentMode === 'local' && !localModelReady) {
    showError('Local model not ready. Run node setup.js to download it.'); return;
  }

  hideError();
  setGenerating(true);
  showProgress(0, currentMode === 'online' ? STATUSES_ONLINE[0] : STATUSES_LOCAL[0]);
  hideResult();

  const speedVal  = document.getElementById('slider-speed').value;
  const volumeVal = document.getElementById('slider-volume').value;
  const pitchVal  = document.getElementById('slider-pitch').value;

  let res;
  try {
    if (currentMode === 'online') {
      res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          profile: selectedProfile,
          rate:   formatRate(speedVal),
          volume: `+${volumeVal}%`,
          pitch:  formatPitch(pitchVal)
        })
      });
    } else {
      res = await fetch('/generate-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice:  selectedVoice,
          speed:  speedVal,
          volume: volumeVal
        })
      });
    }
  } catch (e) {
    showError('Could not reach the server. Is it running?');
    setGenerating(false); hideProgress(); return;
  }

  const { jobId, error } = await res.json();
  if (error) { showError(error); setGenerating(false); hideProgress(); return; }

  currentJobId = jobId;
  pollStatus(jobId, currentMode === 'online' ? STATUSES_ONLINE : STATUSES_LOCAL);
}

function formatRate(val) {
  val = parseInt(val);
  return val >= 0 ? `+${val}%` : `${val}%`;
}

function formatPitch(val) {
  val = parseInt(val);
  return val >= 0 ? `+${val}Hz` : `${val}Hz`;
}

async function pollStatus(jobId, statuses) {
  let statusIdx = 0, lastProgress = 0;

  const tick = async () => {
    try {
      const res  = await fetch(`/status/${jobId}`);
      const data = await res.json();

      if (data.error || data.status === 'error') {
        showError(data.error || 'Generation failed.');
        setGenerating(false); hideProgress(); return;
      }

      const pct = Math.max(lastProgress, data.progress || 0);
      lastProgress = pct;
      statusIdx = Math.min(statusIdx + 1, statuses.length - 1);
      if (pct >= 90) statusIdx = statuses.length - 1;
      showProgress(pct, statuses[statusIdx]);

      if (data.status === 'done') {
        showProgress(100, 'Audio ready');
        setTimeout(() => {
          hideProgress();
          showResult(jobId, data.format);
          setGenerating(false);
        }, 400);
        return;
      }
      pollTimer = setTimeout(tick, 350);
    } catch (e) {
      showError('Lost connection to server.');
      setGenerating(false); hideProgress();
    }
  };
  tick();
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

function setGenerating(on) {
  const btn = document.getElementById('btn-generate');
  btn.disabled = on;
  btn.textContent = on ? 'Generating...' : 'Generate Audio';
}

function showProgress(pct, status) {
  document.getElementById('progress-section').classList.add('visible');
  document.getElementById('progress-fill').style.width      = pct + '%';
  document.getElementById('progress-pct').textContent       = pct + '%';
  document.getElementById('progress-status').textContent    = status;
}

function hideProgress() { document.getElementById('progress-section').classList.remove('visible'); }

function showResult(jobId, format) {
  const ext      = format === 'wav' ? 'wav' : 'mp3';
  const player   = document.getElementById('audio-player');
  const download = document.getElementById('btn-download');
  player.src     = `/audio/${jobId}?t=${Date.now()}`;
  download.href  = `/download/${jobId}`;
  download.download = `mimik_audio.${ext}`;
  document.getElementById('result-section').classList.add('visible');
  player.play().catch(() => {});
}

function hideResult() { document.getElementById('result-section').classList.remove('visible'); }

function reset() {
  if (pollTimer) clearTimeout(pollTimer);
  currentJobId = null;
  document.getElementById('script-text').value = '';
  updateCharCount();
  hideResult(); hideProgress(); hideError(); setGenerating(false);
}

function showError(msg) {
  const el = document.getElementById('error-banner');
  el.textContent = msg; el.classList.add('visible');
}

function hideError() { document.getElementById('error-banner').classList.remove('visible'); }

init();
