#!/usr/bin/env python3
"""
Kokoro TTS subprocess — called by scripter.js (dev) or kokoro_tts binary (packaged).
Uses stdlib `wave` instead of soundfile to keep the PyInstaller bundle small.
"""
import sys, os, json, argparse, wave
import numpy as np

# When running as a PyInstaller binary, sys.executable is the binary itself.
# When running as a plain script, use the script's directory.
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_DIR   = os.path.join(BASE_DIR, 'models')
MODEL_PATH  = os.path.join(MODEL_DIR, 'kokoro-v1.0.int8.onnx')
VOICES_PATH = os.path.join(MODEL_DIR, 'voices-v1.0.bin')


def write_wav(path, samples, sample_rate):
    """Write float32 numpy array to 16-bit WAV using stdlib only."""
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype(np.int16)
    with wave.open(path, 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        f.writeframes(pcm.tobytes())


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--text',   default='')
    p.add_argument('--voice',  default='am_michael')
    p.add_argument('--speed',  type=float, default=1.0)
    p.add_argument('--volume', type=float, default=0.15)
    p.add_argument('--output', default='')
    p.add_argument('--check',  action='store_true')
    args = p.parse_args()

    if args.check:
        ready = os.path.exists(MODEL_PATH) and os.path.exists(VOICES_PATH)
        print(json.dumps({'ready': ready}))
        return

    if not os.path.exists(MODEL_PATH) or not os.path.exists(VOICES_PATH):
        print(json.dumps({'error': 'Model not found. Run: node setup.js'}), file=sys.stderr)
        sys.exit(1)

    if not args.text or not args.output:
        print(json.dumps({'error': '--text and --output required'}), file=sys.stderr)
        sys.exit(1)

    from kokoro_onnx import Kokoro
    k = Kokoro(MODEL_PATH, VOICES_PATH)
    samples, sr = k.create(args.text, voice=args.voice, speed=args.speed, lang='en-us')

    if args.volume != 0:
        samples = np.clip(samples * (1.0 + args.volume), -1.0, 1.0)

    write_wav(args.output, samples, sr)
    print(json.dumps({'ok': True, 'sample_rate': sr, 'duration': round(len(samples) / sr, 2)}))


if __name__ == '__main__':
    main()
