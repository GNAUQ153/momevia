import {dimensionalObject} from './object-construction.js';
import {cameraDepthSvg} from './dimensional-art.js';
// A native, editable instant camera: the exit slot is part of its body.
export function instantCameraSvg(p,prefix='instant-camera'){
 const id=String(prefix).replace(/[^a-zA-Z0-9_-]/g,'-'),ink=p.inkColor||'#27394B',accent=p.accentColor||'#7D3854',detail=p.detailColor||'#A8B9C9';
 const source=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 210" width="280" height="210" aria-hidden="true"><defs><linearGradient id="${id}-body" x2=".2" y2="1"><stop stop-color="#fffaf0"/><stop offset=".55" stop-color="#eadfd2"/><stop offset="1" stop-color="#c8b6aa"/></linearGradient><linearGradient id="${id}-metal" x2="1" y2=".7"><stop stop-color="#f5f8fa"/><stop offset=".4" stop-color="${detail}"/><stop offset="1" stop-color="#667383"/></linearGradient><radialGradient id="${id}-lens" cx="35%" cy="28%"><stop stop-color="#5a7d91"/><stop offset=".4" stop-color="#182f42"/><stop offset="1" stop-color="#080e18"/></radialGradient></defs>
 <rect x="20" y="18" width="241" height="180" rx="35" fill="#00000018"/><rect x="15" y="12" width="244" height="180" rx="35" fill="url(#${id}-body)" stroke="#b6a69a" stroke-width="1.3"/>
 <path d="M16 67Q15 14 50 13H223Q259 13 258 66Z" fill="url(#${id}-metal)"/><path d="M32 72H242" stroke="#ffffff9c" stroke-width="2"/><rect x="34" y="30" width="58" height="27" rx="7" fill="#455365"/><rect x="39" y="34" width="48" height="18" rx="4" fill="#ecf1e9"/><path d="M45 35V51M54 35V51M63 35V51M72 35V51M81 35V51" stroke="#b5c3c5"/>
 <rect x="182" y="29" width="39" height="29" rx="8" fill="${ink}"/><rect x="188" y="34" width="27" height="18" rx="5" fill="#728c9d"/><circle cx="235" cy="80" r="11" fill="${accent}" stroke="#fff8ee" stroke-width="3"/>
 <path d="M30 104Q41 91 53 103V159Q40 171 30 157Z" fill="${accent}" opacity=".8"/><circle cx="143" cy="111" r="53" fill="#00000021"/><circle cx="140" cy="106" r="53" fill="url(#${id}-metal)" stroke="#fff9ec" stroke-width="2"/><circle cx="140" cy="106" r="43" fill="${ink}"/><circle cx="140" cy="106" r="34" fill="url(#${id}-lens)" stroke="#8193a1" stroke-width="2"/><circle cx="140" cy="106" r="21" fill="#0b1423"/><ellipse cx="129" cy="92" rx="12" ry="7" fill="#d9ecf7" opacity=".4" transform="rotate(-35 129 92)"/><circle cx="151" cy="120" r="5" fill="#d8a8be" opacity=".35"/>
 <rect x="56" y="169" width="170" height="14" rx="7" fill="#9f9086"/><rect x="60" y="170" width="162" height="7" rx="3.5" fill="#20232c"/><path d="M45 186H229" stroke="#fff8ed" opacity=".65" stroke-width="2"/>
 </svg>`;
 return dimensionalObject(p)?cameraDepthSvg(source,p,id):source;
}
