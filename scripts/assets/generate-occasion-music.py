"""Tạo 6 giai điệu không lời nguyên bản theo dịp bằng tổng hợp sóng.

Không sử dụng sample, file MIDI hay giai điệu của bên thứ ba.
Đây là công cụ bảo trì (không chạy khi build): Python 3, NumPy, FFmpeg/libmp3lame.
"""
from pathlib import Path
import math
import subprocess
import tempfile
import wave

import numpy as np

RATE = 22_050
DURATION = 24
SAMPLES = RATE * DURATION
DEST = Path(__file__).resolve().parents[2] / 'web' / 'assets' / 'music'

# Các chủ đề 4 hợp âm và chuỗi nốt tự biên soạn, không tái hiện giai điệu ca khúc có sẵn.
# Nốt theo chuẩn MIDI để mọi thay đổi đều truy nguyên và tái tạo được.
TRACKS = {
    'birthday-sparkle': {
        'bpm': 118, 'chords': ((60, 64, 67, 72), (57, 60, 64, 69), (65, 69, 72, 77), (67, 71, 74, 79)),
        'melody': (76, 79, 84, 81, 79, 76, 74, 79, 81, 84, 79, 76, 77, 81, 84, 82),
        'voice': 'bell', 'step': .36,
    },
    'wedding-promise': {
        'bpm': 76, 'chords': ((62, 65, 69, 74), (58, 62, 65, 70), (55, 59, 62, 67), (60, 64, 67, 72)),
        'melody': (74, 77, 81, 77, 74, 72, 69, 74, 77, 79, 76, 72, 70, 74, 77, 74),
        'voice': 'soft-piano', 'step': .72,
    },
    'christmas-lights': {
        'bpm': 98, 'chords': ((64, 67, 71, 76), (60, 64, 67, 72), (57, 60, 64, 69), (59, 63, 66, 71)),
        'melody': (79, 83, 86, 83, 76, 79, 81, 76, 84, 79, 76, 72, 75, 78, 83, 78),
        'voice': 'glass-bell', 'step': .49,
    },
    'newyear-countdown': {
        'bpm': 126, 'chords': ((65, 69, 72, 77), (62, 65, 69, 74), (58, 62, 65, 70), (60, 64, 67, 72)),
        'melody': (77, 84, 81, 77, 79, 84, 89, 84, 82, 79, 77, 81, 84, 86, 81, 77),
        'voice': 'pulse', 'step': .34,
    },
    'tet-spring': {
        'bpm': 109, 'chords': ((60, 64, 67, 72), (62, 65, 69, 74), (57, 60, 64, 69), (55, 59, 62, 67)),
        'melody': (72, 76, 79, 84, 81, 79, 76, 72, 74, 77, 81, 77, 79, 84, 79, 76),
        'voice': 'plucked', 'step': .42,
    },
    'valentine-whisper': {
        'bpm': 72, 'chords': ((57, 60, 64, 69), (53, 57, 60, 65), (55, 59, 62, 67), (52, 56, 59, 64)),
        'melody': (76, 72, 69, 72, 76, 79, 76, 72, 74, 71, 67, 71, 74, 76, 72, 69),
        'voice': 'soft-piano', 'step': .70,
    },
}


def midi_hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def bell(frequency, time, voice):
    if voice in ('bell', 'glass-bell'):
        brightness = .25 if voice == 'bell' else .17
        return np.sin(2 * np.pi * frequency * time) + brightness * np.sin(2 * np.pi * 2.998 * frequency * time)
    if voice == 'plucked':
        return np.sin(2 * np.pi * frequency * time) + .27 * np.sin(2 * np.pi * 2 * frequency * time)
    if voice == 'pulse':
        return np.sin(2 * np.pi * frequency * time) + .2 * np.sin(2 * np.pi * 2 * frequency * time)
    return np.sin(2 * np.pi * frequency * time) + .08 * np.sin(2 * np.pi * 2 * frequency * time)


def compose(config):
    output = np.zeros(SAMPLES, dtype=np.float64)
    section_length = DURATION / len(config['chords'])
    voice = config['voice']
    # Chord pad nhẹ, không chứa mẫu âm thanh bên ngoài.
    for index, chord in enumerate(config['chords']):
        start = round(index * section_length * RATE)
        length = min(round(section_length * RATE), SAMPLES - start)
        t = np.arange(length, dtype=np.float64) / RATE
        env = np.sin(np.pi * np.clip(t / section_length, 0, 1)) ** .55
        for note in chord:
            f = midi_hz(note - 12)
            output[start:start + length] += env * (
                .025 * np.sin(2 * np.pi * f * t) + .004 * np.sin(2 * np.pi * f * 2 * t)
            )

    # Bốn cụm nốt độc lập, mỗi cụm lặp một lần biến đổi nhịp.
    step = config['step']
    count = int(DURATION / step)
    for n in range(count):
        at = n * step
        note = config['melody'][n % len(config['melody'])]
        note += (0 if (n // len(config['melody'])) % 2 == 0 else -12 if n % 8 == 6 else 0)
        start = round(at * RATE)
        length = min(round(min(step * 1.8, 1.1) * RATE), SAMPLES - start)
        if length <= 0:
            continue
        t = np.arange(length, dtype=np.float64) / RATE
        release = 3.1 if voice in ('bell','glass-bell','pulse') else 2.3
        env = (1 - np.exp(-t * 100)) * np.exp(-release * t)
        output[start:start + length] += .115 * env * bell(midi_hz(note), t, voice)

    wet = output.copy()
    # Echo mức nhỏ và fade biên tránh tiếng nổ khi audio.loop.
    for delay, gain in ((.12, .12), (.28, .075), (.45, .035)):
        offset = int(delay * RATE)
        output[offset:] += wet[:-offset] * gain
    t = np.arange(SAMPLES) / RATE
    fade = np.minimum(np.minimum(t / .55, (DURATION - t) / .78), 1)
    output = np.tanh(output * 1.45) * np.clip(fade, 0, 1)
    peak = np.max(np.abs(output))
    return (output / max(peak, 1) * 0.68 * 32767).astype('<i2')


def save(track_id, config):
    DEST.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as folder:
        wav = Path(folder) / 'loop.wav'
        with wave.open(str(wav), 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(RATE)
            out.writeframes(compose(config).tobytes())
        mp3 = DEST / f'{track_id}.mp3'
        subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
            '-codec:a', 'libmp3lame', '-b:a', '80k', str(mp3),
        ], check=True)
        print(track_id, mp3.stat().st_size)


if __name__ == '__main__':
    for name, settings in TRACKS.items():
        save(name, settings)
