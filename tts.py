#!/usr/bin/env python3
"""
Simple Text-to-Speech using Edge-TTS (Microsoft Neural Voices)

Usage:
  python3 tts.py <input>                         read file, save as <input>.mp3
  python3 tts.py <input> <output.mp3>            custom output path
  python3 tts.py <input> <output.mp3> <voice>    custom voice
  echo "Hello" | python3 tts.py -                read from stdin → output.mp3

Options (set via environment variables):
  VOICE    voice name        (default: en-US-AndrewNeural)
  RATE     speaking rate     (default: -5%   → slightly slower, more natural)
  VOLUME   volume boost      (default: +25%  → louder)
  PITCH    pitch shift       (default: +0Hz  → no change)

Examples:
  python3 tts.py script_text
  python3 tts.py script_text narration.mp3
  VOICE=en-US-AvaNeural python3 tts.py script_text
  VOLUME=+40% RATE=-10% python3 tts.py script_text
"""

import asyncio
import sys
import os
import edge_tts

DEFAULT_VOICE  = "en-US-AndrewNeural"   # Warm, Confident, Authentic
DEFAULT_RATE   = "-5%"                  # slightly slower = more expressive
DEFAULT_VOLUME = "+25%"                 # noticeably louder
DEFAULT_PITCH  = "+0Hz"


async def speak(text: str, output_file: str, voice: str, rate: str, volume: str, pitch: str) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume, pitch=pitch)
    await communicate.save(output_file)


def main():
    args = sys.argv[1:]

    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        print_voices()
        sys.exit(0)

    input_arg = args[0]

    if input_arg == "-":
        text = sys.stdin.read().strip()
        default_output = "output.mp3"
    else:
        if not os.path.exists(input_arg):
            print(f"Error: file '{input_arg}' not found", file=sys.stderr)
            sys.exit(1)
        with open(input_arg, "r") as f:
            text = f.read().strip()
        base = os.path.splitext(input_arg)[0]
        default_output = f"{base}.mp3"

    if not text:
        print("Error: no text to convert", file=sys.stderr)
        sys.exit(1)

    output_file = args[1] if len(args) > 1 else default_output
    voice  = args[2] if len(args) > 2 else os.environ.get("VOICE",  DEFAULT_VOICE)
    rate   = args[3] if len(args) > 3 else os.environ.get("RATE",   DEFAULT_RATE)
    volume = args[4] if len(args) > 4 else os.environ.get("VOLUME", DEFAULT_VOLUME)
    pitch  = args[5] if len(args) > 5 else os.environ.get("PITCH",  DEFAULT_PITCH)

    print(f"Voice:   {voice}")
    print(f"Rate:    {rate}  |  Volume: {volume}  |  Pitch: {pitch}")
    print(f"Output:  {output_file}")
    print(f"Text:    {len(text)} characters")
    print("Generating audio...")

    asyncio.run(speak(text, output_file, voice, rate, volume, pitch))

    size_kb = os.path.getsize(output_file) / 1024
    print(f"Done → {output_file} ({size_kb:.1f} KB)")


def print_voices():
    print("""
Recommended voices:
  en-US-AndrewNeural    Warm, Confident, Authentic   ← default (great for tutorials)
  en-US-AvaNeural       Expressive, Caring, Friendly
  en-US-EmmaNeural      Cheerful, Clear, Conversational
  en-US-BrianNeural     Approachable, Casual, Sincere
  en-US-JennyNeural     Friendly, Considerate
  en-US-GuyNeural       Passionate
  en-GB-SoniaNeural     British female
""")


if __name__ == "__main__":
    main()
