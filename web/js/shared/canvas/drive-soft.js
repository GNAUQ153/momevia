export const SOFT_INTERACTIONS=['calendar-peel','camera-print','focus-photo','grade-stamp','ribbon-diploma','four-choice-quiz','peel-letter','tear-ticket','cap-toss'];
export const SOFT_APPEARANCES=['soft-v2','object-natural-v3','album-soft-v2','paper-fold-soft-v3','scratch-progress-soft-v2'];
export const softDuration=speed=>({fast:480,normal:800,slow:1200}[speed]||800);
export function softenElement(model,palette){
 const p=model.props;
 if(model.type==='interaction'){
  if(SOFT_INTERACTIONS.includes(p.kind))p.appearance='soft-v2';
  else if(p.kind==='swipe-album')p.appearance='album-soft-v2';
  else if(p.kind==='foldout-letter')p.appearance='paper-fold-soft-v3';
  else if(p.kind==='scratch-ticket')p.appearance='scratch-progress-soft-v2';else return model;
  Object.assign(p,{cornerRadius:24,motionSpeed:'normal',inkColor:palette.ink,accentColor:palette.accent,detailColor:palette.detail||palette.accent});
 }else if(['envelope','gift-box'].includes(model.type)&&['lid-card-v1','wax-letter-v1','lid-card-v2','wax-letter-v2'].includes(p.preset)){
  p.preset=model.type==='gift-box'?'lid-card-v2':'wax-letter-v2';p.cornerRadius=22;p.motionSpeed='normal';
  model.effects={...model.effects,reaction:model.effects?.reaction||{id:model.type==='gift-box'?'R02':'R01',speed:'normal'}};
 }else if(model.type==='reply'){p.appearance=p.appearance?.startsWith('paper')||p.replyMode==='message'?'paper-soft-v2':'garden-soft-v2';p.cornerRadius=24;}
 else if(model.type==='button')p.radius=Math.max(p.radius||0,16);
 else if(model.type==='shape'&&p.kind==='rectangle'&&!model.artwork&&model.layout.width>80&&model.layout.height>70)p.radius=Math.max(p.radius||0,20);
 else if(model.type==='image'&&p.optional&&!p.mask)p.radius=14;
 return model;
}
