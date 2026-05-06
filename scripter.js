if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto;

const express  = require('express');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const multer   = require('multer');
const { randomUUID: uuidv4 } = require('crypto');
const { spawn } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');

const IS_WIN   = process.platform === 'win32';
const BASE_DIR = __dirname;
const PUBLIC_DIR = path.join(BASE_DIR, 'public');

// ── Logging ───────────────────────────────────────────────────────────────────

const LOG_FILE = path.join(BASE_DIR, 'konvertex.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(line);
  logStream.write(line + '\n');
}

const app    = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Request logger
app.use((req, _res, next) => {
  if (!req.path.startsWith('/status')) log(`${req.method} ${req.path}`);
  next();
});

const jobs = {};

// Kokoro binary (used when running as packaged .exe)
const KOKORO_BIN  = path.join(BASE_DIR, IS_WIN ? 'kokoro_tts.exe' : 'kokoro_tts');
const HAS_KOKORO_BIN = fs.existsSync(KOKORO_BIN);

// venv Python path — used in dev mode (falls back to system python3)
const VENV_PY = IS_WIN
  ? path.join(__dirname, '.venv', 'Scripts', 'python.exe')
  : path.join(__dirname, '.venv', 'bin', 'python3');
const PYTHON  = fs.existsSync(VENV_PY) ? VENV_PY : (IS_WIN ? 'python' : 'python3');

// ── Online profiles (Microsoft Neural) ───────────────────────────────────────

const ONLINE_PROFILES = {
  narrator: {
    label: 'The Narrator', subtitle: 'Andrew', voice: 'en-US-AndrewNeural',
    description: 'Warm, confident and authentic. Built for tutorials and walkthroughs.',
    traits: ['Warm', 'Confident', 'Authentic'],
    defaults: { rate: '-5%', volume: '+15%', pitch: '+8Hz' }
  },
  guide: {
    label: 'The Guide', subtitle: 'Emma', voice: 'en-US-EmmaNeural',
    description: 'Clear, cheerful and conversational. Perfect for step-by-step explainers.',
    traits: ['Clear', 'Cheerful', 'Conversational'],
    defaults: { rate: '-5%', volume: '+15%', pitch: '+5Hz' }
  },
  presenter: {
    label: 'The Presenter', subtitle: 'Ava', voice: 'en-US-AvaNeural',
    description: 'Expressive, caring and friendly. Ideal for product demos.',
    traits: ['Expressive', 'Caring', 'Friendly'],
    defaults: { rate: '-5%', volume: '+15%', pitch: '+5Hz' }
  },
  host: {
    label: 'The Host', subtitle: 'Brian', voice: 'en-US-BrianNeural',
    description: 'Approachable, casual and sincere. Great for informal guides.',
    traits: ['Approachable', 'Casual', 'Sincere'],
    defaults: { rate: '0%', volume: '+15%', pitch: '+0Hz' }
  }
};

// ── Local voices (Kokoro, 28 English characters) ──────────────────────────────

const LOCAL_VOICES = {
  af_heart:    { name: 'Heart',    group: 'American · Female', style: 'Warm, expressive — great all-rounder' },
  af_bella:    { name: 'Bella',    group: 'American · Female', style: 'Vibrant, expressive' },
  af_sarah:    { name: 'Sarah',    group: 'American · Female', style: 'Clear, professional' },
  af_jessica:  { name: 'Jessica',  group: 'American · Female', style: 'Friendly, conversational' },
  af_nova:     { name: 'Nova',     group: 'American · Female', style: 'Energetic, upbeat' },
  af_alloy:    { name: 'Alloy',    group: 'American · Female', style: 'Neutral, crisp' },
  af_aoede:    { name: 'Aoede',    group: 'American · Female', style: 'Melodic, bright' },
  af_kore:     { name: 'Kore',     group: 'American · Female', style: 'Calm, measured' },
  af_river:    { name: 'River',    group: 'American · Female', style: 'Natural, flowing' },
  af_sky:      { name: 'Sky',      group: 'American · Female', style: 'Light, airy' },
  af_nicole:   { name: 'Nicole',   group: 'American · Female', style: 'Soft, breathy' },
  am_michael:  { name: 'Michael',  group: 'American · Male',   style: 'Warm, confident' },
  am_adam:     { name: 'Adam',     group: 'American · Male',   style: 'Deep, authoritative' },
  am_liam:     { name: 'Liam',     group: 'American · Male',   style: 'Approachable, casual' },
  am_eric:     { name: 'Eric',     group: 'American · Male',   style: 'Natural, friendly' },
  am_echo:     { name: 'Echo',     group: 'American · Male',   style: 'Clear, resonant' },
  am_onyx:     { name: 'Onyx',     group: 'American · Male',   style: 'Deep, rich' },
  am_fenrir:   { name: 'Fenrir',   group: 'American · Male',   style: 'Bold, dramatic' },
  am_puck:     { name: 'Puck',     group: 'American · Male',   style: 'Playful, energetic' },
  bf_emma:     { name: 'Emma',     group: 'British · Female',  style: 'Clear, charming' },
  bf_alice:    { name: 'Alice',    group: 'British · Female',  style: 'Refined, precise' },
  bf_isabella: { name: 'Isabella', group: 'British · Female',  style: 'Warm, engaging' },
  bf_lily:     { name: 'Lily',     group: 'British · Female',  style: 'Light, melodic' },
  bm_george:   { name: 'George',   group: 'British · Male',    style: 'Authoritative, refined' },
  bm_daniel:   { name: 'Daniel',   group: 'British · Male',    style: 'Professional, clear' },
  bm_lewis:    { name: 'Lewis',    group: 'British · Male',    style: 'Casual, approachable' },
  bm_fable:    { name: 'Fable',    group: 'British · Male',    style: 'Storytelling, expressive' },
};

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/profiles',     (_req, res) => res.json(ONLINE_PROFILES));
app.get('/local-voices', (_req, res) => res.json(LOCAL_VOICES));

app.get('/local-status', (_req, res) => {
  const ready = fs.existsSync(path.join(BASE_DIR, 'models', 'kokoro-v1.0.int8.onnx'))
    && fs.existsSync(path.join(BASE_DIR, 'models', 'voices-v1.0.bin'));
  res.json({ ready, python: PYTHON });
});

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ text: req.file.buffer.toString('utf-8').trim() });
});

// ── Online generation (Microsoft Edge TTS) ────────────────────────────────────

app.post('/generate', async (req, res) => {
  const { text, profile: profileKey, rate, volume, pitch } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

  const profile = ONLINE_PROFILES[profileKey] || ONLINE_PROFILES.narrator;
  const jobId   = uuidv4();
  const outPath = path.join(os.tmpdir(), `konvertex_${jobId}.mp3`);

  jobs[jobId] = { status: 'running', progress: 10, outputPath: outPath, format: 'mp3' };
  res.json({ jobId });

  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(profile.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    jobs[jobId].progress = 30;

    const { audioStream } = tts.toStream(text, {
      rate:   rate   || profile.defaults.rate,
      volume: volume || profile.defaults.volume,
      pitch:  pitch  || profile.defaults.pitch
    });

    const ws = fs.createWriteStream(outPath);
    const wordCount = text.trim().split(/\s+/).length;
    const expectedChunks = Math.max(10, Math.floor(wordCount / 10));
    let chunks = 0;
    audioStream.on('data', () => {
      chunks++;
      jobs[jobId].progress = Math.min(93, 30 + Math.round((chunks / expectedChunks) * 63));
    });
    audioStream.pipe(ws);
    ws.on('finish', () => { jobs[jobId].status = 'done'; jobs[jobId].progress = 100; });
    ws.on('error',  e  => { jobs[jobId].status = 'error'; jobs[jobId].error = e.message; log(`ERROR online job ${jobId}: ${e.message}`); });
    audioStream.on('error', e => { jobs[jobId].status = 'error'; jobs[jobId].error = e.message; log(`ERROR online stream ${jobId}: ${e.message}`); });
  } catch (e) {
    jobs[jobId] = { status: 'error', error: e.message };
  }
});

// ── Local generation (Kokoro via venv Python) ─────────────────────────────────

app.post('/generate-local', (req, res) => {
  const { text, voice, speed, volume } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

  const jobId   = uuidv4();
  const outPath = path.join(os.tmpdir(), `konvertex_${jobId}.wav`);

  jobs[jobId] = { status: 'running', progress: 15, outputPath: outPath, format: 'wav' };
  res.json({ jobId });

  const speedFloat  = Math.max(0.5, Math.min(2.0, 1.0 + (parseFloat(speed  || '0') / 40)));
  const volumeFloat = parseFloat(volume || '0') / 100;

  // Packaged build: use bundled kokoro_tts binary. Dev mode: use venv Python + script.
  const [cmd, cmdArgs] = HAS_KOKORO_BIN
    ? [KOKORO_BIN, []]
    : [PYTHON, [path.join(__dirname, 'kokoro_tts.py')]];

  const proc = spawn(cmd, [
    ...cmdArgs,
    '--text',   text,
    '--voice',  voice || 'am_michael',
    '--speed',  String(speedFloat),
    '--volume', String(volumeFloat),
    '--output', outPath
  ]);

  jobs[jobId].progress = 10;

  let stderr = '';
  proc.stdout.on('data', d => {
    for (const line of d.toString().split('\n')) {
      try {
        const msg = JSON.parse(line.trim());
        if (typeof msg.progress === 'number') jobs[jobId].progress = msg.progress;
      } catch {}
    }
  });
  proc.stderr.on('data', d => { stderr += d.toString(); });
  proc.on('close', code => {
    if (code !== 0) {
      jobs[jobId].status = 'error';
      jobs[jobId].error  = stderr || `Process exited with code ${code}`;
      log(`ERROR local job ${jobId}: ${jobs[jobId].error}`);
    } else {
      jobs[jobId].status = 'done'; jobs[jobId].progress = 100;
    }
  });
});

// ── Shared endpoints ──────────────────────────────────────────────────────────

app.get('/status/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, progress: job.progress, error: job.error, format: job.format });
});

app.get('/audio/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job || job.status !== 'done') return res.status(400).json({ error: 'Not ready' });
  res.setHeader('Content-Type', job.format === 'wav' ? 'audio/wav' : 'audio/mpeg');
  res.sendFile(job.outputPath);
});

app.get('/download/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job || job.status !== 'done') return res.status(400).json({ error: 'Not ready' });
  res.download(job.outputPath, `konvertex_audio.${job.format === 'wav' ? 'wav' : 'mp3'}`);
});

const PORT = process.env.PORT || 8004;
app.listen(PORT, () => {
  log(`Konvertex running at http://localhost:${PORT}`);
  log(`Log file: ${LOG_FILE}`);
});
