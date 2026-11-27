// Event views are derived at render time; never duplicate a stored event date.
export function calendarMonth(eventAt, timeZone='Asia/Ho_Chi_Minh', locale='vi') {
  if(!eventAt)return null;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date(eventAt)).map(p=>[p.type,p.value]));
  const year=Number(parts.year),month=Number(parts.month),day=Number(parts.day);
  return {year,month,day,offset:(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7,days:new Date(Date.UTC(year,month,0)).getUTCDate(),title:new Intl.DateTimeFormat(locale,{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(Date.UTC(year,month-1,1)))};
}
const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function graduationPassSvg({name,eventAt,timeZone,venue,title}) {
  const when=eventAt?new Intl.DateTimeFormat('vi-VN',{timeZone,dateStyle:'long',timeStyle:'short'}).format(new Date(eventAt)):'';
  const lines=s=>String(s).match(/.{1,38}(?:\s|$)|.{1,38}/gu)||[''];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500" viewBox="0 0 900 500"><rect x="2" y="2" width="896" height="496" rx="20" fill="#EEF3F6" stroke="#29445D" stroke-width="4"/><g font-family="serif" fill="#29445D"><text x="45" y="65" font-size="25">${xml(title)}</text>${lines(name).slice(0,3).map((s,i)=>`<text x="45" y="${120+i*36}" font-size="30">${xml(s)}</text>`).join('')}<text x="45" y="270" font-size="23">${xml(when)}</text>${lines(venue).slice(0,4).map((s,i)=>`<text x="45" y="${320+i*30}" font-size="23">${xml(s)}</text>`).join('')}</g><path d="M770 15V485" stroke="#A84540" stroke-dasharray="8 8"/><text x="805" y="350" transform="rotate(-90 805 350)" fill="#29445D" font-size="24">MOMEVIA</text></svg>`;
}
