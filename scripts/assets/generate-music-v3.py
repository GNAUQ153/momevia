"""Tạo hai vòng nhạc nền mới cho Momevia bằng tổng hợp sóng, không dùng sample ngoài.

Công cụ bảo trì, không chạy khi build website. Phụ thuộc: Python 3, NumPy, FFmpeg (libmp3lame).
"""
from pathlib import Path
import argparse
import subprocess
import tempfile
import wave

import numpy as np

RATE = 22050
DURATION = 24
N = RATE * DURATION
OUT = Path(__file__).resolve().parents[2] / 'web' / 'assets' / 'music'

if (OUT / 'v2' / 'catalog.json').exists():
    raise SystemExit('Legacy music generator is archived; import licensed author music with import-recorded-audio.py.')


def synthesize(chords, tempo, salt):
    """Âm sắc bell/pad nhẹ và chuỗi nốt tự biên soạn, có fade chống tiếng nổ."""
    out = np.zeros(N, dtype=np.float64)
    notes_per_bar = 6
    segment = DURATION / len(chords)
    for i, chord in enumerate(chords):
        start = round(i * segment * RATE)
        length = min(round(segment * RATE), N - start)
        t = np.arange(length) / RATE
        envelope = np.sin(np.pi * np.minimum(t / segment, 1.0)) ** 0.65
        for offset in chord:
            f = 440.0 * 2 ** ((offset - 69) / 12)
            out[start:start + length] += envelope * (.037 * np.sin(2*np.pi*f*t) + .008 * np.sin(4*np.pi*f*t))
    beat = 60 / tempo
    step = beat * 1.35
    for n, at in enumerate(np.arange(0, DURATION - 1.4, step)):
        chord = chords[min(len(chords) - 1, int(at // segment))]
        pattern = (0, 2, 1, 3, 2, 1)
        tone = chord[(pattern[n % notes_per_bar] + salt) % len(chord)] + 12
        f = 440.0 * 2 ** ((tone - 69) / 12)
        start = round(at * RATE)
        length = min(round(1.4 * RATE), N - start)
        t = np.arange(length) / RATE
        env = (1 - np.exp(-t * 65)) * np.exp(-t * (3.2 if tempo > 95 else 2.6))
        out[start:start+length] += env * .105 * (np.sin(2*np.pi*f*t) + .07 * np.sin(6*np.pi*f*t))
    dry = out.copy()
    for delay, amount in [(0.16, .18), (0.33, .085), (.53, .045)]:
        d = round(delay * RATE)
        out[d:] += dry[:-d] * amount
    idx = np.arange(N) / RATE
    envelope = np.minimum(1, idx / .6) * np.minimum(1, (DURATION - idx) / .85)
    return np.clip(np.tanh(out * 1.65) * envelope * .70, -1, 1)


def encode(name, chords, tempo, salt):
    samples = synthesize(chords, tempo, salt)
    with tempfile.TemporaryDirectory() as folder:
        temp = Path(folder) / (name + '.wav')
        with wave.open(str(temp), 'wb') as file:
            file.setnchannels(1)
            file.setsampwidth(2)
            file.setframerate(RATE)
            file.writeframes((samples * 32767).astype('<i2').tobytes())
        OUT.mkdir(parents=True, exist_ok=True)
        subprocess.run([
            'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(temp),
            '-codec:a', 'libmp3lame', '-b:a', '72k', '-ar', str(RATE),
            str(OUT / (name + '.mp3')),
        ], check=True)
        print(name, (OUT / (name + '.mp3')).stat().st_size)


if __name__ == '__main__':
    # Hai tiến trình hòa âm nguyên bản: nhịp chậm 84 BPM và vui 118 BPM.
    encode('dreamy-night', [[57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 55, 60, 64]], 84, 1)
    encode('little-celebration', [[62, 66, 69, 74], [59, 62, 66, 71], [64, 67, 71, 76], [57, 61, 64, 69]], 118, 2)
