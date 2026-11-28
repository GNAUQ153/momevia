export const DIMENSIONAL_OBJECT='dimensional-v2';
export const DIMENSIONAL_KINDS=['camera-print','cap-toss','calendar-peel'];
export const supportsDimensional=p=>p.kind==='cap-toss'?p.appearance==='object-studio-v5':p.kind==='calendar-peel'?p.appearance==='object-crafted-v4':p.kind==='camera-print'&&['object-studio-v5','object-crafted-v4'].includes(p.appearance);
export const dimensionalObject=p=>p.objectConstruction===DIMENSIONAL_OBJECT&&supportsDimensional(p);
export const objectDepth=p=>dimensionalObject(p)?p.objectDepth??10:0;
