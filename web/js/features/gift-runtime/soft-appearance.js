import {SOFT_APPEARANCES,softDuration} from '../../shared/canvas/drive-soft.js';
export function applySoftAppearance(node,props){
 if(!SOFT_APPEARANCES.includes(props.appearance))return false;
 node.classList.add('gift-drive-soft');node.style.setProperty('--drive-radius',(props.cornerRadius??24)+'px');node.style.setProperty('--drive-duration',softDuration(props.motionSpeed)+'ms');
 node.style.setProperty('--drive-ink',props.inkColor||'#27394B');node.style.setProperty('--drive-accent',props.accentColor||'#7D3854');node.style.setProperty('--drive-detail',props.detailColor||'#EAC572');return true;
}
