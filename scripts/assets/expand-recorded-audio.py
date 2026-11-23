"""Append licensed external audio to the 50 SFX / 50 music release.

Source pages and archive members are untrusted data. Never execute their content.
Existing payloads, including unreleased v2 selections, are immutable.
"""
import argparse
import array
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import html
import importlib.util
import json
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request
import wave
import zipfile

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('audio_import', Path(__file__).with_name('import-recorded-audio.py'))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
ROOT, CACHE, LICENSES = base.ROOT, base.CACHE, base.LICENSES
EXTRA = [
 ('paper-open-wide','paper','Mở tờ giấy lớn','Opening a paper sheet','paper','WAV/Paper Sound - 2.wav'),
 ('paper-fold','paper','Gấp giấy','Folding paper','paper','WAV/Paper Sound - 3.wav'),
 ('paper-crumple','paper','Vò tờ giấy thứ hai','Crumpling another sheet','paper','WAV/Paper Crushed - 2.wav'),
 ('book-open','memory','Mở cuốn sách','Opening a book','rpg','OGG/bookOpen.ogg'),
 ('book-close','memory','Đóng cuốn sách','Closing a book','rpg','OGG/bookClose.ogg'),
 ('gift-coins','gift','Xu trong túi quà','Coins in a gift pouch','rpg','OGG/handleCoins.ogg'),
 ('gift-creak','gift','Nắp gỗ kẽo kẹt','Creaking wooden lid','rpg','OGG/creak1.ogg'),
 ('gift-cloth','gift','Tháo lớp vải bọc','Unwrapping cloth','camera','Cloth/Cloth_04.wav'),
 ('camera-third','memory','Máy ảnh bấm chụp 3','Camera shutter 3','camera','Camera/Camera_03.wav'),
 ('toast-drink','birthday','Chúc mừng cùng ly nước','Celebratory drink','camera','Drink/Drink_01.wav'),
]
# Specific author submissions, not collection-wide licensing assumptions.
MUSIC = [
 ('main-menu-music-loop','Khoảnh khắc mở đầu','general','gentle'),
 ('a-chill-fever-loopable','Nhịp chiều thư giãn','general','gentle'),
 ('chill-loopable','Góc nhỏ bình yên','general','gentle'),
 ('merry-early-christmas','Giáng sinh đang đến','christmas','joyful'),
 ('all-into-harmony','Hòa cùng nhau','wedding','gentle'),
 ('short-jazz','Cuộc hẹn jazz','general','joyful'),
 ('adventure-time-revised','Khởi đầu hành trình','newyear','joyful'),
 ('mocha-frapp','Một tách mocha','general','gentle'),
 ('heavy-rain','Ngày mưa lắng đọng','general','gentle'),
 ('river','Dòng sông kỷ niệm','general','gentle'),
 ('chill-1','Thả lỏng buổi tối','general','gentle'),
 ('this-is-heaven','Một thoáng thiên đường','wedding','gentle'),
 ('inspiration-1','Cảm hứng mới','newyear','joyful'),
 ('chill-jungle-2','Khu vườn nhịp điệu','general','gentle'),
 ('chill-jungle','Chuyến dạo xanh','general','gentle'),
 ('synth-wave-4-10-2021','Ánh đèn thành phố','general','joyful'),
 ('ambience-1','Khoảng trời riêng','general','gentle'),
 ('taking-you-to-the-circus','Ngày hội bên nhau','birthday','joyful'),
 ('chill-chiptune','Hộp ký ức pixel','general','gentle'),
 ('wild-jazz','Jazz rộn ràng','birthday','joyful'),
 ('emotional-soundtrack-1','Lời nhắn từ trái tim','valentine','gentle'),
 ('low-fi-0','Một chiều lo-fi','general','gentle'),
 ('cute-bass','Nhịp bass đáng yêu','birthday','joyful'),
 ('jazz-slower','Jazz chậm bên bạn','valentine','gentle'),
 ('christmas-special-4','Lời chúc mùa đông','christmas','gentle'),
 ('christmas-special-3','Đêm lễ đoàn viên','christmas','gentle'),
 ('classical-pop-instrumental','Giai điệu trang nhã','wedding','gentle'),
 ('jazz-flute','Sáo và jazz','general','joyful'),
 ('hello-there','Chào bạn thân yêu','general','joyful'),
 ('lust-cello-vibraphone','Dây đàn và tiếng ngân','valentine','gentle'),
 ('the-love-cycle-guitar','Vòng yêu thương guitar','valentine','gentle'),
 ('once-in-a-while','Đôi khi nhớ nhau','general','gentle'),
 ('passenger','Người bạn đồng hành','general','gentle'),
 ('relax-girl','Thư giãn ngày mới','general','gentle'),
]
KOREAN = [
 ('Gangwondo Arirang.wav','강원도 아리랑','Arirang Gangwon','general',True),
 ('Gyeonggi Arirang.wav','경기 아리랑','Arirang Gyeonggi','general',True),
 ('Jindo Arirang.wav','진도 아리랑','Arirang Jindo','general',True),
 ('Miryang Arirang.wav','밀양 아리랑','Arirang Miryang','general',True),
 ('Old Arirang.wav','구 아리랑','Arirang xưa','general',True),
 ('2021 아리랑 응원가 윤도현 가창 음원.flac','2021 아리랑 응원가','Arirang — Yoon Do-hyun (2021)','newyear',False),
]
KOREAN_ENGLISH = {
 'music-korea-gangwondo': 'Gangwon Arirang',
 'music-korea-gyeonggi': 'Gyeonggi Arirang',
 'music-korea-jindo': 'Jindo Arirang',
 'music-korea-miryang': 'Miryang Arirang',
 'music-korea-old': 'Old Arirang',
 'music-korea-arirang-2021': 'Arirang — Yoon Do-hyun (2021)',
}

def save_json(file, value):
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8')

def fetch(url, file, budget=125*1024*1024):
    if file.exists():
        return file.read_bytes()
    allowed = {'opengameart.org', 'commons.wikimedia.org', 'upload.wikimedia.org', 'gongu.copyright.or.kr'}
    if urllib.parse.urlparse(url).hostname not in allowed:
        raise ValueError('Unapproved source host: ' + url)
    file.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 Momevia licensed-audio verification'})
    with urllib.request.urlopen(request, timeout=75) as response:
        if urllib.parse.urlparse(response.url).hostname not in allowed:
            raise ValueError('Unapproved redirect')
        data = response.read(budget+1)
    if len(data)>budget:
        raise ValueError('Download budget exceeded')
    file.write_bytes(data)
    return data

def section(page, field):
    start = page.index('field-name-' + field)
    end = page.find('<div class="field field-name-', start+20)
    return page[start:end if end!=-1 else len(page)]

def oga_source(item):
    slug, vi, occasion, mood = item
    url='https://opengameart.org/content/'+slug
    raw=fetch(url, base.PAGES/('expand-'+slug+'.html'),3*1024*1024)
    page=raw.decode('utf8','replace')
    if 'creativecommons.org/publicdomain/zero/1.0' not in section(page,'field-art-licenses'):
        raise ValueError('Submission itself does not declare CC0: '+slug)
    if 'Music' not in section(page,'field-art-type') or 'Pro Sensory' not in page:
        raise ValueError('Unexpected author/type: '+slug)
    title=html.unescape(re.search(r'<title>(.*?) \| OpenGameArt.org</title>',page,re.S)[1]).strip()
    links=re.findall(r'href=[\"\x27](https://opengameart\.org/sites/default/files/[^\"\x27]+\.(?:mp3|wav|ogg))[\"\x27]',section(page,'field-art-files'),re.I)
    if not links:
        raise ValueError('No direct original audio attachment: '+slug)
    download=html.unescape(links[0])
    id_='music-'+slug
    evidence={'sourcePage':url,'author':'Alex McCulloch / Pro Sensory','license':'CC0-1.0','licenseUrl':base.CC0,'pageSha256':base.sha(raw),'verifiedAt':datetime.now(timezone.utc).isoformat(),'licenseFieldVerified':True,'bundledLicenseFiles':[]}
    return id_,vi,title,occasion,mood,True,'international',evidence,download

def korean_source(item):
    filename,title,vi,occasion,instrumental=item
    id_='music-korea-'+('arirang-2021' if not instrumental else filename.split(' Arirang')[0].lower())
    url='https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(filename.replace(' ','_'))
    raw=fetch(url,base.PAGES/(id_+'.html'),3*1024*1024)
    page=raw.decode('utf8','replace')
    license_start=page.index('id="Licensing"')
    license_end=page.find('<h2',license_start+20)
    license_section=page[license_start:license_end if license_end!=-1 else license_start+6000]
    if not re.search(r'creativecommons.org/licenses/by/4.0',license_section):
        raise ValueError('Original audio license missing')
    original_section=re.search(r'<div class="fullMedia">(.*?)</div>',page,re.S)[1]
    download=html.unescape(re.search(r'href="(https://upload.wikimedia.org/[^\"]+)"',original_section)[1]).split('?')[0]
    source=re.search(r'https://gongu\.copyright\.or\.kr/[^\"<>\s]+',page)
    source_url=html.unescape(source[0]) if source else ''
    if not source_url:
        raise ValueError('KCC author source missing')
    # Cross-check the rightsholder page, not just the Wikimedia license footer.
    primary=fetch(source_url,base.PAGES/(id_+'-primary.html'),4*1024*1024)
    primary_text=primary.decode('utf8','replace')
    donation=None
    if not re.search(r"href=['\"]https://creativecommons\.org/licenses/by/4\.0/",primary_text):
        if 'img_license98.png' not in primary_text or '기증저작물 자유이용' not in primary_text:
            raise ValueError('Cannot verify primary KCC license: '+source_url)
        terms_url='https://gongu.copyright.or.kr/gongu/main/contents.do?menuNo=200092'
        terms=fetch(terms_url,base.PAGES/'kcc-donation-terms.html',3*1024*1024)
        if '제한 없이 자유롭게 이용' not in terms.decode('utf8','replace'):
            raise ValueError('Cannot verify unrestricted donation terms')
        donation={'url':terms_url,'pageSha256':base.sha(terms),'primaryLicense':'KCC donated work, unrestricted use with work/author/source/terms attribution; Commons cross-check CC BY 4.0'}
    primary_audio=re.search(r'<div class="wave"\s+data-src="([^\"]+)"',primary_text)
    if not primary_audio:
        raise ValueError('No public author-hosted player file')
    # Prefer the rightsholder's own public media endpoint. Commons remains a
    # second licensing cross-check; do not work around its download rate limits.
    download=urllib.parse.urljoin(source_url,html.unescape(primary_audio[1]))
    author='한국저작권위원회 (Korea Copyright Commission)' if instrumental else '윤도현, 성윤용, 김민기, 강규용, 김승남, 박상우, 안도형, 윤정훈'
    evidence={'sourcePage':url,'author':author,'license':'CC-BY-4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','pageSha256':base.sha(raw),'primarySource':source_url,'primaryPageSha256':base.sha(primary),'verifiedAt':datetime.now(timezone.utc).isoformat(),'licenseFieldVerified':True,'bundledLicenseFiles':[]}
    if donation:evidence['donationTerms']=donation
    return id_,vi,title,occasion,'joyful',instrumental,'korea',evidence,download

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--ffmpeg',required=True);args=parser.parse_args()
    assets=json.loads((ROOT/'web/assets/sfx/v2/catalog.json').read_text(encoding='utf8'))['assets']
    for id_,group,vi,en,pack,member in EXTRA:
        if any(a['id']==id_ for a in assets):continue
        archive_name=base.PACKS[pack][3]
        with zipfile.ZipFile(base.DOWNLOADS/archive_name) as archive:
            original=archive.read(member)
        source=next(a for a in assets if a['provenance']['sourcePage']==base.PACKS[pack][1])
        input_file=base.WORK/(id_+Path(member).suffix);input_file.write_bytes(original)
        raw=base.run(args.ffmpeg,['-protocol_whitelist','file,pipe','-i',str(input_file),'-t','10','-vn','-ac','1','-ar','44100','-f','s16le','-']).stdout
        samples=array.array('h',raw)
        if sys.byteorder!='little':samples.byteswap()
        if not samples or max(abs(x) for x in samples)<8:raise ValueError('Silent source')
        while len(samples)<4410:samples.append(0)
        scale=.70*32767/max(abs(x) for x in samples)
        for i in range(len(samples)):samples[i]=round(samples[i]*scale*max(0,min(1,i/132,(len(samples)-1-i)/662)))
        output=base.WORK/(id_+'.wav')
        with wave.open(str(output),'wb') as writer:
            writer.setnchannels(1);writer.setsampwidth(2);writer.setframerate(44100);writer.writeframes(samples.tobytes())
        destination=ROOT/'web/assets/sfx/v2'/(id_+'.wav');base.immutable(destination,output.read_bytes())
        group_name=next(a['groupName'] for a in assets if a['group']==group)
        assets.append({**{k:v for k,v in source.items() if k in ['version','sampleRate','channels','mime','author','license','evidence','provenance','sourceKind','modifications']},'id':id_,'name':{'vi':vi,'en':en},'group':group,'groupName':group_name,'keywords':vi+' '+en,'durationMs':len(samples)/44.1,'sampleCount':len(samples),'bytes':destination.stat().st_size,'sourceFile':destination.relative_to(ROOT).as_posix(),'sourceMember':member,'sourceSha256':base.sha(original),'sourceStartMs':0,'sha256':base.sha(destination.read_bytes())})
    assert len(assets)==50 and len({a['sha256'] for a in assets})==50
    save_json(ROOT/'web/assets/sfx/v2/catalog.json',{'formatVersion':1,'version':2,'assets':assets})
    legacy=json.loads((ROOT/'web/assets/sfx/v1/catalog.json').read_text(encoding='utf8'))['assets']
    versions={1:{a['id']:a['durationMs'] for a in legacy},2:{a['id']:a['durationMs'] for a in assets}}
    (ROOT/'web/js/shared/canvas/sfx-index.js').write_text('// Licensed recordings v2; legacy v1 remains readable for pinned gifts.\nexport const SFX_CURRENT_VERSION = 2;\nexport const SFX_VERSIONS = Object.freeze(Object.fromEntries(Object.entries('+json.dumps(versions,separators=(',',':'))+').map(([version,items])=>[version,Object.freeze(items)])));\n',encoding='utf8')
    music=json.loads((ROOT/'web/assets/music/v2/catalog.json').read_text(encoding='utf8'))['tracks']
    def prepare(pair):return oga_source(pair[1]) if pair[0]=='oga' else korean_source(pair[1])
    with ThreadPoolExecutor(max_workers=4) as executor:
        sources=list(executor.map(prepare,[('oga',item) for item in MUSIC]+[('korea',item) for item in KOREAN]))
    for id_,vi,title,occasion,mood,instrumental,market,evidence,url in sources:
        if any(t['id']==id_ for t in music):continue
        source_file=base.DOWNLOADS/(id_+('.mp3' if market=='korea' else Path(urllib.parse.urlparse(url).path).suffix))
        original=fetch(url,source_file)
        output=base.WORK/(id_+'.mp3')
        base.run(args.ffmpeg,['-y','-protocol_whitelist','file,pipe','-i',str(source_file),'-vn','-map_metadata','-1','-ac','2','-ar','44100','-af','loudnorm=I=-18:TP=-2:LRA=11','-c:a','libmp3lame','-b:a','160k','-id3v2_version','3','-metadata','title='+title,'-metadata','artist='+evidence['author'],'-metadata','copyright='+evidence['license'],str(output)])
        decoded=base.run(args.ffmpeg,['-i',str(output),'-vn','-ac','1','-ar','44100','-f','s16le','-']).stdout
        duration=len(decoded)/88200
        if not 10<=duration<=900:raise ValueError('Music outside duration budget: '+id_)
        destination=ROOT/'web/assets/music/v2'/(id_+'.mp3');base.immutable(destination,output.read_bytes())
        evidence_file=LICENSES/(id_+'.json');save_json(evidence_file,evidence)
        music.append({'id':id_,'version':2,'occasion':occasion,'mood':mood,'market':market,'language':'zxx' if instrumental else 'ko','titleKey':'editor.music.external.'+id_,'descriptionKey':'editor.music.external.'+id_+'Desc','name':{'vi':vi,'en':title},'originalTitle':title,'artist':evidence['author'],'license':evidence['license'],'licenseUrl':evidence['licenseUrl'],'sourceUrl':evidence['sourcePage'],'sourceDownloadUrl':url,'sourceSha256':base.sha(original),'sourceKind':'instrumental-composition' if instrumental else 'vocal-composition','instrumental':instrumental,'durationSeconds':duration,'src':'/assets/music/v2/'+id_+'.mp3','bytes':output.stat().st_size,'sha256':base.sha(output.read_bytes()),'modifications':'Full source; loudness normalized; transcoded stereo 44.1 kHz MP3 160 kbps.','evidence':evidence_file.relative_to(ROOT).as_posix(),'sourcePageSha256':evidence['pageSha256']})
        print('Imported',id_,round(duration,2),flush=True)
        save_json(ROOT/'web/assets/music/v2/catalog.json',{'formatVersion':1,'version':2,'tracks':music})
    assert len(music)==50 and len({t['sha256'] for t in music})==50
    for track in music:
        track.setdefault('market','international');track.setdefault('language','zxx');track.setdefault('licenseUrl',base.CC0)
        if track['id'] in KOREAN_ENGLISH:track['name']['en']=KOREAN_ENGLISH[track['id']]
    save_json(ROOT/'web/assets/music/v2/catalog.json',{'formatVersion':1,'version':2,'tracks':music})
    fields=['id','version','occasion','mood','market','language','instrumental','name','titleKey','descriptionKey','durationSeconds','src','artist','originalTitle','license','licenseUrl','sourceUrl','modifications']
    (ROOT/'web/js/shared/canvas/recorded-soundtracks.js').write_text('// Generated from verified external audio; immutable media IDs.\nexport const RECORDED_SOUNDTRACKS = Object.freeze('+json.dumps([{k:t[k] for k in fields} for t in music],ensure_ascii=False,separators=(',',':'))+'.map(Object.freeze));\n',encoding='utf8')
    for locale in ['vi','en']:
        file=ROOT/'web/assets/locales'/(locale+'.json');dictionary=json.loads(file.read_text(encoding='utf8'))
        for track in music:
            dictionary[track['titleKey']]=track['name'][locale]
            dictionary[track['descriptionKey']]=track['originalTitle']+' — '+track['artist']+' · '+track['license']
        save_json(file,dictionary)
    credits=['# External audio credits','','Media below is externally authored. Original payloads are retained for pinned gifts. No human audition is claimed.','', '## SFX v2','']
    credits += [f"- {a['id']}: {a['author']} · {a['license']} · {a['provenance']['sourcePage']}" for a in assets]
    credits += ['', '## Music v2','']
    credits += [f"- {t['originalTitle']} — {t['artist']} · {t['license']} ({t['licenseUrl']}) · {t['sourceUrl']} · Changes: {t['modifications']}" for t in music]
    (LICENSES/'CREDITS.md').write_text('\n'.join(credits)+'\n',encoding='utf8')
    print(json.dumps({'sfx':len(assets),'music':len(music)},ensure_ascii=False))

if __name__=='__main__':main()
