"""Import licensed author recordings/compositions; never synthesize waveforms.

Only known public asset URLs are downloaded. Web pages/ZIP text are evidence,
never instructions or executable code. Originals stay in ignored local storage.
Run with Python 3 and --ffmpeg <path>. Existing published output is immutable.
"""
import argparse
import array
import concurrent.futures
import hashlib
import html
import json
from datetime import datetime, timezone
from pathlib import Path
import re
import subprocess
import sys
import urllib.parse
import urllib.request
import wave
import zipfile

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'local/audio-real-20261122'
PAGES = CACHE / 'sources'
DOWNLOADS = CACHE / 'downloads'
WORK = CACHE / 'processed'
LICENSES = ROOT / 'web/assets/audio-licenses'
CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/'
PACKS = {
 'paper': ('Luckius', 'https://opengameart.org/content/various-paper-sound-effects', 'https://opengameart.org/sites/default/files/sounds_6.zip', 'paper.zip'),
 'rpg': ('Kenney Vleugels', 'https://opengameart.org/content/50-rpg-sound-effects', 'https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip', 'kenney-rpg-oga.zip'),
 'ui': ('Kenney Vleugels', 'https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks', 'https://opengameart.org/sites/default/files/UI_SFX_Set.zip', 'kenney-ui-oga.zip'),
 'interface': ('Kenney Vleugels', 'https://opengameart.org/content/interface-sounds', 'https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip', 'kenney-interface-oga.zip'),
 'jingles': ('Kenney Vleugels', 'https://opengameart.org/content/85-short-music-jingles', 'https://opengameart.org/sites/default/files/jingleSounds_Kenney.zip', 'kenney-jingles-oga.zip'),
 'camera': ('OwlishMedia / Ashe Kirk', 'https://opengameart.org/content/202-more-sound-effects', 'https://opengameart.org/sites/default/files/MoreSounds.zip', 'foley.zip'),
}
FREESOUND = {
 'tape': ('Jarebear1223', 'https://freesound.org/people/Jarebear1223/sounds/618541/'),
 'box': ('SpliceSound', 'https://freesound.org/people/SpliceSound/sounds/188189/'),
 'candle': ('tlcolbe', 'https://freesound.org/people/tlcolbe/sounds/406646/'),
 'confetti': ('Streety', 'https://freesound.org/people/Streety/sounds/26349/'),
 'balloon': ('Sadiquecat', 'https://freesound.org/people/Sadiquecat/sounds/817800/'),
 'applause': ('freesound / La audiencia disponible recording team', 'https://freesound.org/people/freesound/sounds/25295/'),
 'drop': ('willstepp', 'https://freesound.org/people/willstepp/sounds/188293/'),
 'heart-recorded': ('thenudo', 'https://freesound.org/people/thenudo/sounds/146765/'),
}
DIRECT = {
 'clock': ('bart', 'https://opengameart.org/content/ticking-clock', 'https://opengameart.org/sites/default/files/ticking_clock.wav'),
 'rain': ('Ove Melaa', 'https://opengameart.org/content/rain-ambient-not-loopable-2-versions-available', 'https://opengameart.org/sites/default/files/Ove%20Melaa%20-%20Rainy%20%28NOT%20loopable%29.ogg'),
 'birds': ('Thimras', 'https://opengameart.org/content/park-ambiences', 'https://opengameart.org/sites/default/files/park_ambience_birds.wav'),
 'wind': ('Thimras', 'https://opengameart.org/content/park-ambiences', 'https://opengameart.org/sites/default/files/park_ambience_wind.wav'),
 'river': ('Thimras', 'https://opengameart.org/content/park-ambiences', 'https://opengameart.org/sites/default/files/park_ambience_river.wav'),
}
# IDs retain semantic continuity only within version 2. Version 1 is untouched.
# Labels describe the actual source rather than claiming a different instrument.
SFX = [
 ('paper','Thư và giấy','Letters & paper',[
  ('seal-peel','Bóc băng dính niêm phong','Peeling packing tape','tape','',0,4.16),
  ('letter-unfold','Mở nếp giấy','Opening folded paper','paper','WAV/Paper Sound - 1.wav',0,4),
  ('page-turn','Lật trang sách','Turning a book page','rpg','OGG/bookFlip1.ogg',0,4),
  ('paper-rustle','Giấy xào xạc','Paper rustle','paper','WAV/Paper Sound - 4.wav',0,5),
  ('pen-sign','Xé giấy nhẹ','Tearing paper','paper','WAV/Paper Ripped - 1.wav',0,4)]),
 ('gift','Hộp và quà','Boxes & gifts',[
  ('ribbon-untie','Vải nơ xào xạc','Cloth ribbon rustle','rpg','OGG/cloth1.ogg',0,4),
  ('box-pop','Mở hộp và lớp bọc','Opening a box and wrapping','box','',0,8),
  ('gift-shake','Túi quà sột soạt','Leather gift pouch handling','rpg','OGG/handleSmallLeather.ogg',0,4),
  ('wood-lid','Bật chốt hộp','Opening a metal latch','rpg','OGG/metalLatch.ogg',0,4),
  ('wrap-tear','Vò giấy gói','Crumpling gift paper','paper','WAV/Paper Crushed - 1.wav',0,4)]),
 ('sparkle','Lấp lánh','Sparkles',[
  ('tiny-spark','Leng keng thủy tinh 1','Glass sparkle 1','interface','Audio/glass_001.ogg',0,5),
  ('fairy-dust','Leng keng thủy tinh 2','Glass sparkle 2','interface','Audio/glass_002.ogg',0,5),
  ('star-trail','Ngân dây đàn','Plucked string sparkle','interface','Audio/pluck_001.ogg',0,5),
  ('glass-twinkle','Leng keng thủy tinh 3','Glass sparkle 3','interface','Audio/glass_003.ogg',0,5),
  ('magic-reveal','Ngân dây đàn đôi','Double plucked sparkle','interface','Audio/pluck_002.ogg',0,5)]),
 ('birthday','Sinh nhật','Birthday',[
  ('candle-blow','Thổi tắt nến','Blowing out a candle','candle','',0,2.1),
  ('confetti-pop','Bật pháo giấy','Party popper','confetti','',0,1),
  ('balloon-pop','Bóng bay nổ trong phòng','Balloon pop in a room','balloon','',0,1.5),
  ('birthday-chime','Vỗ tay chúc mừng','Celebration applause','applause','',0,3.9),
  ('party-horn','Nhạc hiệu tiệc nhỏ','Little party stinger','jingles','OGG/jingles_SAX/jingles_SAX00.ogg',0,8)]),
 ('memory','Kỷ niệm','Memories',[
  ('camera-shutter','Máy ảnh bấm chụp 1','Camera shutter 1','camera','Camera/Camera_01.wav',0,4),
  ('projector-click','Máy ảnh bấm chụp 2','Camera shutter 2','camera','Camera/Camera_02.wav',0,4),
  ('heartbeat','Nhịp tim thu bằng ống nghe','Heartbeat recorded with a stethoscope','heart-recorded','',0,3),
  ('music-box','Đặt cuốn album xuống','Placing an album down','rpg','OGG/bookPlace1.ogg',0,4),
  ('clock-tick','Đồng hồ tích tắc','Clock ticking','clock','',0,3)]),
 ('interaction','Tương tác','Interaction',[
  ('soft-tap','Bấm nút nhẹ','Soft button click','ui','click1.wav',0,2),
  ('gentle-click','Bấm chuột','Mouse click','ui','mouseclick1.wav',0,2),
  ('swipe-whoosh','Trượt giao diện','Interface scroll','interface','Audio/scroll_001.ogg',0,3),
  ('choice-ding','Bật công tắc','Switch selection','ui','switch1.wav',0,2),
  ('success-pair','Xác nhận hoàn tất','Confirmation','interface','Audio/confirmation_001.ogg',0,4)]),
 ('nature','Thiên nhiên','Nature',[
  ('water-drop','Nước nhỏ từ vòi','Water dripping from a tap','drop','',0,3),
  ('rain-window','Mưa rơi','Rain falling','rain','',2,5),
  ('bird-call','Chim trong công viên','Birds in a park','birds','',2,5),
  ('gentle-wind','Gió ngoài đồng','Wind in an open field','wind','',2,5),
  ('shore-wave','Nước chảy ven bờ','Small river flowing','river','',2,5)]),
 ('melody','Giai điệu ngắn','Short melodies',[
  ('warm-ending','Kết ấm áp — đàn dây','Warm string ending','jingles','OGG/jingles_PIZZA/jingles_PIZZA00.ogg',0,10),
  ('playful-ending','Kết vui — saxophone','Playful saxophone ending','jingles','OGG/jingles_SAX/jingles_SAX01.ogg',0,10),
  ('tender-ending','Kết dịu — ngân thép','Tender steel ending','jingles','OGG/jingles_STEEL/jingles_STEEL00.ogg',0,10),
  ('bright-ending','Kết rạng rỡ — đàn dây','Bright string ending','jingles','OGG/jingles_PIZZA/jingles_PIZZA02.ogg',0,10),
  ('goodnight-ending','Kết yên — ngân thép','Quiet steel ending','jingles','OGG/jingles_STEEL/jingles_STEEL03.ogg',0,10)]),
]
MUSIC = [
 ('happy','music-happy','birthday','joyful','Sinh nhật tươi vui','Happy birthday','Happy','Alex McCulloch / Pro Sensory'),
 ('serenade-guitar','music-serenade','wedding','gentle','Lời hẹn guitar','Guitar promise','Serenade (Guitar)','Alex McCulloch / Pro Sensory'),
 ('in-love','music-in-love','valentine','gentle','Dịu dàng yêu thương','Tender love','In Love','Alex McCulloch / Pro Sensory'),
 ('wintery-loop','music-wintery','christmas','gentle','Giáng sinh ấm áp','Cozy Christmas','Wintery loop','Emma_MA'),
 ('congratulations','music-congratulations','newyear','joyful','Chúc mừng khởi đầu mới','Celebrate a new beginning','Congratulations','Alex McCulloch / Pro Sensory'),
 ('sunny-side-up','music-sunny-side-up','tet','joyful','Ngày xuân sum vầy','A bright spring gathering','Sunny Side Up','Alex McCulloch / Pro Sensory'),
 ('i-dreamed-of-you-last-night','music-dreamed','general','gentle','Kỷ niệm trong mơ','Dreaming of memories','I Dreamed of You Last Night','Alex McCulloch / Pro Sensory'),
 ('you-and-me','music-you-and-me','general','joyful','Bạn và tôi','You and me','You and Me','Alex McCulloch / Pro Sensory'),
 ('taken-lightly','music-taken-lightly','general','joyful','Một lời cảm ơn','A little thank you','Taken Lightly','Alex McCulloch / Pro Sensory'),
 ('one-step-at-a-time','music-one-step','general','joyful','Bước tiếp vững vàng','One step forward','One Step at a Time','Alex McCulloch / Pro Sensory'),
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def fetch(url, target, max_bytes=125 * 1024 * 1024):
    if target.exists():
        return target.read_bytes()
    allowed = {'opengameart.org', 'freesound.org', 'cdn.freesound.org', 'kenney.nl', 'creativecommons.org'}
    if urllib.parse.urlparse(url).hostname not in allowed:
        raise ValueError('Unapproved asset host')
    target.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 Momevia licensed audio import'})
    chunks, size = [], 0
    with urllib.request.urlopen(request, timeout=90) as response:
        if urllib.parse.urlparse(response.url).hostname not in allowed:
            raise ValueError('Unapproved asset redirect')
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                raise ValueError('Asset exceeds download budget')
            chunks.append(chunk)
    data = b''.join(chunks)
    target.write_bytes(data)
    return data

def page_evidence(key, url, author):
    # License only: no comments, scripts, archive instructions or executable text.
    data = fetch(url, PAGES / (key + '.html'), 3 * 1024 * 1024)
    page = data.decode('utf8', 'replace')
    if not re.search(r'creativecommons\.org/publicdomain/zero/1\.0', page):
        raise ValueError('Author page does not declare CC0: ' + url)
    record = {'sourcePage': url, 'author': author, 'license': 'CC0-1.0', 'licenseUrl': CC0, 'pageSha256': sha(data), 'verifiedAt': datetime.now(timezone.utc).isoformat()}
    (LICENSES / (key + '.json')).write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    return page, record

def immutable(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() != data:
        raise ValueError('Published audio is immutable; use a new version: ' + str(path))
    if not path.exists():
        path.write_bytes(data)

def run(ffmpeg, arguments):
    return subprocess.run([ffmpeg, '-nostdin', '-hide_banner', '-loglevel', 'error', *arguments], check=True, capture_output=True, timeout=180)

def main():
    expanded = ROOT / 'web/assets/music/v2/catalog.json'
    if expanded.exists() and len(json.loads(expanded.read_text(encoding='utf8'))['tracks']) > 10:
        raise ValueError('Expanded catalog exists; use expand-recorded-audio.py. Existing published catalogs must not shrink.')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', required=True)
    args = parser.parse_args()
    for directory in [PAGES, DOWNLOADS, WORK, LICENSES]:
        directory.mkdir(parents=True, exist_ok=True)
    sources = {}
    for key, (author, page_url, url, filename) in PACKS.items():
        _, evidence = page_evidence(key, page_url, author)
        archive_bytes = fetch(url, DOWNLOADS / filename, 30 * 1024 * 1024)
        archive = zipfile.ZipFile(DOWNLOADS / filename)
        license_names = [f for f in archive.namelist() if f.lower().endswith(('.txt', '.md')) and archive.getinfo(f).file_size < 50000]
        bundled = []
        for index, filename in enumerate(license_names):
            text = archive.read(filename)
            if b'CC0' in text or b'commercial projects' in text:
                destination = LICENSES / f'{key}-upstream-{index}.txt'
                destination.write_bytes(text)
                bundled.append({'archiveMember': filename, 'path': destination.relative_to(ROOT).as_posix(), 'sha256': sha(text)})
        sources[key] = {**evidence, 'sourceDownloadUrl': url, 'archiveSha256': sha(archive_bytes), 'bundledLicenseFiles': bundled, 'archive': archive}
    for key, (author, url) in FREESOUND.items():
        page, evidence = page_evidence(key, url, author)
        matches = re.findall(r'https://cdn\.freesound\.org/previews/[^\s\"<>]+?-hq\.mp3', page)
        if not matches:
            raise ValueError('No public audio preview URL on the author page')
        audio_url = html.unescape(matches[0])
        filename = DOWNLOADS / (key + '.mp3')
        audio = fetch(audio_url, filename, 12 * 1024 * 1024)
        sources[key] = {**evidence, 'sourceDownloadUrl': audio_url, 'sourceRepresentation': 'author-hosted public high-quality MP3 preview', 'sourceFileSha256': sha(audio), 'file': filename, 'bundledLicenseFiles': []}
    for key, (author, page_url, url) in DIRECT.items():
        _, evidence = page_evidence(key, page_url, author)
        filename = DOWNLOADS / (key + Path(urllib.parse.urlparse(url).path).suffix)
        audio = fetch(url, filename)
        sources[key] = {**evidence, 'sourceDownloadUrl': url, 'sourceFileSha256': sha(audio), 'file': filename, 'bundledLicenseFiles': []}
    assets = []
    for group, vi, en, members in SFX:
        for id_, name_vi, name_en, source_id, member, start, duration in members:
            source = sources[source_id]
            if member:
                info = source['archive'].getinfo(member)
                if info.file_size > 12 * 1024 * 1024:
                    raise ValueError('Unexpected archive audio size')
                original = source['archive'].read(member)
                input_file = WORK / (id_ + Path(member).suffix)
                input_file.write_bytes(original)
            else:
                input_file = source['file']
                original = input_file.read_bytes()
            # Decode, select, mix/resample and normalize an existing recording.
            # This path creates no oscillators, notes, noise or replacement audio.
            result = run(args.ffmpeg, ['-protocol_whitelist', 'file,pipe', '-ss', str(start), '-i', str(input_file), '-t', str(duration), '-vn', '-ac', '1', '-ar', '44100', '-f', 's16le', '-'])
            samples = array.array('h', result.stdout)
            if sys.byteorder != 'little':
                samples.byteswap()
            if not samples or max(abs(v) for v in samples) < 8:
                raise ValueError('Silent or undecodable input: ' + id_)
            while len(samples) < 4410:
                samples.append(0)
            samples = samples[:441000]
            scale = 0.70 * 32767 / max(abs(v) for v in samples)
            for i in range(len(samples)):
                fade = min(1, i / 132, (len(samples) - 1 - i) / 662)
                samples[i] = round(samples[i] * scale * max(0, fade))
            output = WORK / (id_ + '.wav')
            with wave.open(str(output), 'wb') as writer:
                writer.setnchannels(1)
                writer.setsampwidth(2)
                writer.setframerate(44100)
                writer.writeframes(samples.tobytes())
            data = output.read_bytes()
            destination = ROOT / 'web/assets/sfx/v2' / (id_ + '.wav')
            immutable(destination, data)
            public_source = {k: v for k, v in source.items() if k not in ('archive', 'file')}
            if not public_source.get('bundledLicenseFiles'):
                public_source['licenseEvidenceNote'] = 'No separate license text in this download; the original author submission explicitly links CC0. See recorded author-page evidence.'
            kind = 'authored-sfx' if source_id in ('interface', 'jingles', 'ui') else 'recording'
            assets.append({'id': id_, 'version': 2, 'name': {'vi': name_vi, 'en': name_en}, 'group': group, 'groupName': {'vi': vi, 'en': en}, 'keywords': f'{name_vi} {name_en} {vi} {en}', 'durationMs': len(samples) / 44.1, 'sampleCount': len(samples), 'sampleRate': 44100, 'channels': 1, 'mime': 'audio/wav', 'bytes': len(data), 'sourceFile': destination.relative_to(ROOT).as_posix(), 'author': source['author'], 'license': 'CC0-1.0', 'evidence': f'web/assets/audio-licenses/{source_id}.json', 'sourceKind': kind, 'sourceMember': member or input_file.name, 'sourceSha256': sha(original), 'sourceStartMs': start * 1000, 'modifications': 'excerpt, mono 44.1kHz PCM16, peak normalization, 3ms/15ms edge fades; no synthesized content', 'sha256': sha(data), 'provenance': public_source})
    assert len(assets) == 40 and len(set(a['sha256'] for a in assets)) == 40
    (ROOT / 'web/assets/sfx/v2/catalog.json').write_text(json.dumps({'formatVersion': 1, 'version': 2, 'assets': assets}, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    v1 = json.loads((ROOT / 'web/assets/sfx/v1/catalog.json').read_text(encoding='utf8'))['assets']
    versions = {1: {a['id']: a['durationMs'] for a in v1}, 2: {a['id']: a['durationMs'] for a in assets}}
    (ROOT / 'web/js/shared/canvas/sfx-index.js').write_text('// Licensed recordings v2; legacy v1 remains readable for pinned gifts.\nexport const SFX_CURRENT_VERSION = 2;\nexport const SFX_VERSIONS = Object.freeze(Object.fromEntries(Object.entries(' + json.dumps(versions, separators=(',', ':')) + ').map(([version,items])=>[version,Object.freeze(items)])));\n', encoding='utf8')
    music = []
    for slug, id_, occasion, mood, title_vi, title_en, original_title, author in MUSIC:
        page_url = 'https://opengameart.org/content/' + slug
        page, evidence = page_evidence('music-' + slug, page_url, author)
        # File attachment URLs only; preview widgets and commenter URLs ignored.
        section = page[page.find('class="field field-name-field-art-files'):]
        matches = re.findall(r'href=[\"\x27](https://opengameart\.org/sites/default/files/[^\"\x27]+\.(?:mp3|wav|ogg))[\"\x27]', section, re.I)
        if not matches:
            raise ValueError('Author attachment missing: ' + slug)
        url = html.unescape(matches[0])
        source_file = DOWNLOADS / ('music-' + slug + Path(urllib.parse.urlparse(url).path).suffix)
        original = fetch(url, source_file)
        output = WORK / (id_ + '.mp3')
        run(args.ffmpeg, ['-y', '-protocol_whitelist', 'file,pipe', '-i', str(source_file), '-vn', '-map_metadata', '-1', '-ac', '2', '-ar', '44100', '-af', 'loudnorm=I=-18:TP=-2:LRA=11', '-c:a', 'libmp3lame', '-b:a', '160k', '-id3v2_version', '3', '-metadata', 'title=' + original_title, '-metadata', 'artist=' + author, '-metadata', 'copyright=CC0-1.0', '-metadata', 'comment=' + page_url, str(output)])
        decoded = run(args.ffmpeg, ['-i', str(output), '-vn', '-ac', '1', '-ar', '44100', '-f', 's16le', '-']).stdout
        duration = len(decoded) / 2 / 44100
        if duration < 10 or duration > 900:
            raise ValueError('Unexpected music duration')
        destination = ROOT / 'web/assets/music/v2' / (id_ + '.mp3')
        immutable(destination, output.read_bytes())
        title_key, desc_key = 'editor.music.external.' + id_, 'editor.music.external.' + id_ + 'Desc'
        music.append({'id': id_, 'version': 2, 'occasion': occasion, 'mood': mood, 'titleKey': title_key, 'descriptionKey': desc_key, 'name': {'vi': title_vi, 'en': title_en}, 'originalTitle': original_title, 'artist': author, 'license': 'CC0-1.0', 'sourceUrl': page_url, 'sourceDownloadUrl': url, 'sourceSha256': sha(original), 'sourceKind': 'instrumental-composition', 'instrumental': True, 'durationSeconds': duration, 'src': '/assets/music/v2/' + id_ + '.mp3', 'bytes': output.stat().st_size, 'sha256': sha(output.read_bytes()), 'modifications': 'full original composition; loudness normalization; stereo 44.1kHz MP3 160kbps; no synthesized replacement', 'evidence': 'web/assets/audio-licenses/music-' + slug + '.json', 'sourcePageSha256': evidence['pageSha256']})
    (ROOT / 'web/assets/music/v2/catalog.json').write_text(json.dumps({'formatVersion': 1, 'version': 2, 'tracks': music}, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    fields = ['id', 'version', 'occasion', 'mood', 'titleKey', 'descriptionKey', 'durationSeconds', 'src', 'artist', 'originalTitle', 'license', 'sourceUrl']
    public = [{k: a[k] for k in fields} for a in music]
    (ROOT / 'web/js/shared/canvas/recorded-soundtracks.js').write_text('// Generated from the verified external music catalog. Never replace a published ID.\nexport const RECORDED_SOUNDTRACKS = Object.freeze(' + json.dumps(public, ensure_ascii=False, separators=(',', ':')) + '.map(Object.freeze));\n', encoding='utf8')
    for locale in ['vi', 'en']:
        file = ROOT / 'web/assets/locales' / (locale + '.json')
        dictionary = json.loads(file.read_text(encoding='utf8'))
        for track in music:
            dictionary[track['titleKey']] = track['name'][locale]
            dictionary[track['descriptionKey']] = track['originalTitle'] + ' — ' + track['artist'] + ' · CC0'
        file.write_text(json.dumps(dictionary, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    credits = ['# External audio sources', '', 'All new assets below were imported from their original author submissions under CC0-1.0. No waveform or music was synthesized by Momevia for version 2.', '', 'Source archives and raw author-page snapshots are retained under ignored local/audio-real-20261122/. Bundled upstream licenses are retained beside this file; missing bundled license files are explicitly noted in each catalog and are backed by the author-page declaration.', '', '## SFX v2', '']
    credits += [f"- {a['id']}: {a['author']} — {a['provenance']['sourcePage']} — {a['provenance']['sourceDownloadUrl']} — CC0-1.0" for a in assets]
    credits += ['', '## Instrumental music v2', '']
    credits += [f"- {a['originalTitle']} — {a['artist']} — {a['sourceUrl']} — CC0-1.0" for a in music]
    credits += ['', 'Licensing: https://creativecommons.org/publicdomain/zero/1.0/legalcode', '', 'Foley/field recordings and authored interface/jingle sounds are distinguished in the catalog. Instrumental status follows source instrumentation and requires listening review; automated checks do not claim human audition.', '', 'Historical synthesized v1 effects and original 24-second music files remain unchanged only for already-pinned gifts.']
    (LICENSES / 'CREDITS.md').write_text('\n'.join(credits) + '\n', encoding='utf8')
    print(json.dumps({'sfx': len(assets), 'music': len(music), 'musicDurations': {a['id']: round(a['durationSeconds'], 3) for a in music}, 'sfxBytes': sum(a['bytes'] for a in assets), 'musicBytes': sum(a['bytes'] for a in music)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
