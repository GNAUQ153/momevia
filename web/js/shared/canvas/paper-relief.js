import {shadeHex} from './gift-volume.js';
export const paperReliefEnabled=p=>p.paperRelief===true&&(p.objectDepth??8)>0;
const mix=(color,target,amount)=>'#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*(1-amount)+parseInt(target.slice(i,i+2),16)*amount).toString(16).padStart(2,'0')).join('');
export function reliefColors(color,depth=8){const strength=Math.min(1.5,depth/8);return {light:mix(color,'#FFFFFF',.2*strength),glint:mix(color,'#FFFFFF',.35*strength),dark:mix(color,'#000000',.16*strength)};}
export function reliefGradient(id,color,{roll=false,depth=8}={}){
 const {light,glint,dark}=reliefColors(color,depth);
 const stops=roll?[[0,dark],[.22,light],[.38,glint],[.66,color],[1,dark]]:[[0,light],[.42,color],[1,dark]];
 return `<linearGradient id="${id}" x1="0%" y1="0%" x2="${roll?'100%':'85%'}" y2="${roll?'0%':'100%'}">${stops.map(([offset,color])=>`<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`;
}
export function envelopeReliefDepth(p,prefix){
 if(!paperReliefEnabled(p))return '';const d=(p.objectDepth??8)/8;
 return `<defs><filter id="${prefix}-depth" x="-30%" y="-30%" width="160%" height="180%" color-interpolation-filters="sRGB"><feDropShadow dx="${-.35*d}" dy="${-.35*d}" stdDeviation="0" flood-color="#FFF2DB" flood-opacity=".38"/><feDropShadow dx="${.7*d}" dy="${1.5*d}" stdDeviation=".2" flood-color="${shadeHex(p.color||'#773447',-.48)}"/><feDropShadow dx="${1.5*d}" dy="${5*d}" stdDeviation="${3*d}" flood-color="#201020" flood-opacity=".25"/></filter></defs>`;
}
