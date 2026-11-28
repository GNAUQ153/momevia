import {tactilePaper} from '../../shared/canvas/tactile-paper.js';
import {dimensionalObject} from '../../shared/canvas/object-construction.js';
import { reflowSceneNodes,growReadingSurfaces } from './reflow.js';
import {ENVELOPE_SOURCE_PRESET} from '../../shared/canvas/studio-constants.js';
import { fittedPage,bodyFit,pageChunks } from './page-fit.js';
import { scenePresentation } from '../../shared/canvas/scene-presentation.js';
import { isSceneFooter, sceneFrameLayout } from '../../shared/canvas/scene-footer.js';
import { isPaperTransition, sceneDirection } from './scene-transition.js';
import { responsiveTextSize,responsiveControlSize } from '../../shared/canvas/responsive-type.js';
import { eventMapUrl, eventCalendar } from '../../shared/canvas/event-actions.js';
import { publicInvitation } from '../../shared/canvas/invitation.js';
import { isGardenDocument } from '../../shared/canvas/garden-tea.js';
import { coverHasRecipient, displayRecipient } from '../../shared/recipient-naming.js';
import { validateDocument, runtimeVersionFor } from "../../shared/canvas/schema.js";
import { message, setAttr, setText, t } from "../../core/i18n.js";
import { focusVisibleTarget } from "../../core/motion.js";
import { renderElement, applyLayout, updateElementCopy, applyStationerySurface } from "./renderer.js";
import {NATURAL_ARTWORK_LABEL} from '../../shared/canvas/event-media.js';
import { builtinPreset } from '../../shared/canvas/effects.js';
import { applySurface, createMotion, playAmbience, playElement, playReaction, sceneTransition } from "./effects.js";
import { playCelebrations } from './celebrations.js';
import { createSceneNavigation } from './scene-navigation.js';
import { createSoundPlayer } from './audio.js';
import { DRIVE_BLOCKS } from '../../shared/canvas/drive-elements.js';
import {DRIVE_OPENING_PRESETS} from '../../shared/canvas/natural-objects.js';
import { createSoundtrackPlayback } from './soundtrack.js';
import { stationeryFlow } from '../../shared/canvas/stationery-flow.js';
export { renderElement, applyLayout, resolveText } from "./renderer.js";

export function mountPlayer(
  root,
  {
    document: input,
    assetUrl,
    invitation,
    mode = "preview",
    replyAdapter,
    onSceneChange = () => {},
    effectPreview,
    runtimeVersion = runtimeVersionFor(input),
  } = {},
) {
  if (runtimeVersion !== runtimeVersionFor(input))
    throw new Error(t("gift.runtime.unsupportedVersion"));
  if (!["preview", "public"].includes(mode))
    throw new Error(t("gift.runtime.invalidMode"));
  let document = validateDocument(input, {
    mode: mode === "public" ? "publish" : "draft",
    requiredBindings: [],
  });
  const recipientContainer = mode === 'public' ? root.closest?.('.recipient-shell') : null;
  const gardenFrame = recipientContainer && isGardenDocument(document);
  if (gardenFrame) {
    recipientContainer.classList.add('recipient-shell-garden');
    recipientContainer.closest('.recipient-section')?.classList.add('recipient-section--garden');
    globalThis.document.documentElement.classList.add('has-garden-gift');
  }
  if (recipientContainer) {
    const size = document.artboard.baseSize;
    recipientContainer.style.setProperty('--gift-artboard-ratio', String(size.width / size.height));
    recipientContainer.style.setProperty('--gift-content-limit', `${document.responsive.desktop.maxContentWidth}px`);
  }
  root.style.setProperty('--gift-artboard-ratio',String(document.artboard.baseSize.width/document.artboard.baseSize.height));
  root.style.setProperty('--gift-content-limit',`${document.responsive.desktop.maxContentWidth}px`);
  let activeSceneId = effectPreview?.sceneId || document.entrySceneId,
    disposed = false,
    sceneController = null,
    resizeObserver = null,
    navigationIntent = null;
  const shell = globalThis.document.createElement("div");
  shell.className = `gift-runtime gift-runtime-mode-${mode}`;
  const driveDocument=document.elements.some(e=>DRIVE_BLOCKS.some(([id])=>id===e.props.kind)||DRIVE_OPENING_PRESETS.includes(e.props.preset)||e.accessibility?.label==='Momevia Drive vinyl v1');
  if(driveDocument){shell.classList.add('gift-runtime-drive');recipientContainer?.classList.add('recipient-shell-drive');recipientContainer?.closest('.recipient-section')?.classList.add('recipient-section--drive');}
  if (isGardenDocument(document)) shell.classList.add('gift-runtime-garden');
  if (document.personalization) shell.classList.add('gift-runtime-personalized');
  if (document.personalization && document.personalization.mode !== 'manual' && !coverHasRecipient(document)) {
    const dedication = globalThis.document.createElement('h1');
    dedication.className = 'recipient-dedication';
    setText(dedication, message('recipient.address', { name: displayRecipient(document) }));
    shell.append(dedication);
  }
  if(document.elements.some(e=>(e.id==='reply-object-paper'||e.id.startsWith('reply-object-paper-'))&&e.type==='image'&&e.accessibility?.label===NATURAL_ARTWORK_LABEL)){
    shell.classList.add('is-natural-stationery');
    const accent=document.elements.find(e=>e.type==='button'&&e.props.color)?.props.color;
    if(accent)shell.style.setProperty('--stationery-accent',accent);
  }
  if(effectPreview?.family)shell.dataset.effectPreview=effectPreview.family;
  if (mode !== 'public') shell.style.maxWidth = `${document.responsive.desktop.maxContentWidth}px`;
  const marker = globalThis.document.createElement("p");
  marker.className = "gift-runtime-mode-label";
  setText(marker, mode === "preview" ? message("gift.player.previewMode") : "");
  const status = globalThis.document.createElement("p");
  status.className = "gift-runtime-status";
  status.setAttribute("role", "status");
  const stage = globalThis.document.createElement("section");
  stage.className = "gift-runtime-stage";
  stage.tabIndex = -1;
  const navigation = globalThis.document.createElement("nav");
  navigation.className = "gift-runtime-navigation";
  setAttr(navigation, "aria-label", message("gift.player.scenes"));
  const progress = globalThis.document.createElement("progress");
  progress.className = "gift-runtime-progress";
  setAttr(progress, "aria-label", message("gift.player.progressLabel"));
  const lifetime = new AbortController();
  const pageNavigation=globalThis.document.createElement('nav');pageNavigation.className='gift-page-navigation';pageNavigation.hidden=true;
  const pagePrevious=globalThis.document.createElement('button'),pageNext=globalThis.document.createElement('button'),pagePosition=globalThis.document.createElement('span');
  pagePrevious.type=pageNext.type='button';pagePrevious.textContent='‹';pageNext.textContent='›';
  setAttr(pagePrevious,'aria-label',message('gift.page.previous'));setAttr(pageNext,'aria-label',message('gift.page.next'));
  pagePosition.setAttribute('role','status');pageNavigation.append(pagePrevious,pagePosition,pageNext);
  let turnPage=()=>false,relayout=()=>{},refreshPageCopy=()=>{};
  pagePrevious.addEventListener('click',()=>turnPage(-1),{signal:lifetime.signal});pageNext.addEventListener('click',()=>turnPage(1),{signal:lifetime.signal});
  const audio=createSoundPlayer({assetUrl,onError:error=>setText(status,message(error?.code==='AUDIO_UNSUPPORTED'?'sfx.unsupportedPlayback':'sfx.playError'))});
  const hasSound=document.elements.some(e=>e.sound);
  const soundControl=globalThis.document.createElement('button');
  soundControl.type='button';soundControl.className='gift-sound-control';soundControl.dataset.soundControl='';
  const updateSound=()=>{setText(soundControl,message(audio.enabled?'sfx.mute':'sfx.enable'));soundControl.setAttribute('aria-pressed',String(audio.enabled));};
  function prepareSceneSound(){
    if(!audio.enabled||!sceneController||globalThis.document.hidden)return;
    const scene=document.scenes.find(s=>s.id===activeSceneId);
    for(const model of document.elements.filter(e=>scene.elementIds.includes(e.id)&&e.visible!==false&&e.sound&&e.type!=='sound-button'))void audio.prepare(model.sound,{signal:sceneController.signal});
  }
  soundControl.addEventListener('click',()=>{audio.setEnabled(!audio.enabled);updateSound();prepareSceneSound();},{signal:lifetime.signal});updateSound();
  globalThis.document.addEventListener('visibilitychange',()=>{if(globalThis.document.hidden)audio.suspend();else prepareSceneSound();},{signal:lifetime.signal});
  globalThis.addEventListener('pagehide',()=>audio.suspend(),{signal:lifetime.signal});
  const sceneNavigation = mode === 'preview' ? createSceneNavigation(navigation, progress, {
    compact:true,
    onSelect: id => requestScene(id,undefined,{focus:false}),
    signal: lifetime.signal,
  }) : null;
  const preference = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  let motionOff = false, resumeCelebrations = () => {}, resumeElements = () => {};
  const motion = createMotion(() => !preference.matches && !motionOff);
  const motionControl = globalThis.document.createElement("button");
  motionControl.type = "button";
  motionControl.className = "gift-motion-control";
  setText(motionControl, message("gift.player.motion"));
  const toolbar = globalThis.document.createElement("div");
  toolbar.className = "gift-motion-toolbar";
  const skip = globalThis.document.createElement("button");
  skip.type = "button";
  skip.className = "gift-typewriter-skip";
  skip.hidden = true;
  setText(skip, message("gift.player.skipTyping"));
  const typewriters = new Set();
  skip.addEventListener("click", () => typewriters.forEach(finish => finish()), { signal: lifetime.signal });
  toolbar.append(motionControl, skip);
  const drivePlayback=driveDocument||isGardenDocument(document);
  let soundtrackPlayback = null;
  stage.addEventListener('play',event=>{if(event.target.tagName==='VIDEO'&&event.target.closest('.gift-local-video')){audio.stop();soundtrackPlayback?.pause();}},{capture:true,signal:lifetime.signal});
  if (document.soundtrack) {
    toolbar.classList.add('gift-motion-toolbar--music');
    const musicGroup = globalThis.document.createElement('div');
    musicGroup.className = 'gift-soundtrack-control';
    const musicButton = globalThis.document.createElement('button');
    musicButton.type = 'button';
    musicButton.className = 'gift-soundtrack-button';
    musicButton.setAttribute('aria-pressed', 'false');
    const musicVolumeLabel = globalThis.document.createElement('label');
    musicVolumeLabel.className = 'gift-soundtrack-volume-label';
    const musicVolumeTitle = globalThis.document.createElement('span');
    setText(musicVolumeTitle, message('gift.music.volume'));
    const musicVolume = globalThis.document.createElement('input');
    musicVolume.className = 'gift-soundtrack-volume';
    musicVolume.type = 'range';
    musicVolume.min = '0';
    musicVolume.max = '100';
    musicVolume.step = '5';
    musicVolume.value = String(Math.round(document.soundtrack.volume * 100));
    const musicVolumeReadout = globalThis.document.createElement('output');
    musicVolumeReadout.className = 'gift-soundtrack-volume-value';
    setText(musicVolumeReadout, `${musicVolume.value}%`);
    musicVolumeLabel.append(musicVolumeTitle, musicVolume, musicVolumeReadout);
    const musicStatus = globalThis.document.createElement('span');
    musicStatus.className = 'gift-soundtrack-status';
    musicStatus.setAttribute('role', 'status');
    const syncMusic = ({ playing, error = false }) => {
      if(drivePlayback)shell.dataset.driveMusic=playing?'playing':'paused';
      musicButton.setAttribute('aria-pressed', String(playing));
      setText(musicButton, message(playing ? 'gift.music.pause' : 'gift.music.play'));
      setText(musicStatus, error ? message('gift.music.error') : message('gift.music.optIn'));
    };
    soundtrackPlayback = createSoundtrackPlayback(document.soundtrack, { onState: syncMusic });
    syncMusic({ playing: false });
    musicButton.addEventListener('click', () => { void soundtrackPlayback.toggle(); }, { signal: lifetime.signal });
    musicVolume.addEventListener('input', () => {
      const percent = Number(musicVolume.value);
      if (!Number.isFinite(percent)) return;
      if (soundtrackPlayback.setVolume(percent / 100)) setText(musicVolumeReadout, `${percent}%`);
    }, { signal: lifetime.signal });
    globalThis.document.addEventListener('visibilitychange', () => {
      if (globalThis.document.hidden) soundtrackPlayback.pause();
    }, { signal: lifetime.signal });
    musicGroup.append(musicButton, musicVolumeLabel, musicStatus);
    const track=soundtrackPlayback.track;
    if(track.artist){
      const credit=globalThis.document.createElement('small');credit.className='gift-music-credit';
      credit.append(`${track.originalTitle} — ${track.artist} - `);
      const license=globalThis.document.createElement('a');license.href=track.licenseUrl||'https://creativecommons.org/publicdomain/zero/1.0/';license.target='_blank';license.rel='noopener noreferrer';license.textContent=track.license;credit.append(license,` - `);
      const source=globalThis.document.createElement('a');source.href=track.sourceUrl;source.target='_blank';source.rel='noopener noreferrer';setText(source,message('editor.music.source'));credit.append(source);musicGroup.append(credit);
      const changes=globalThis.document.createElement('span');setText(changes,message('musicLibrary.mediaChanges'));credit.append(' - ',changes);
    }
    if(driveDocument){
      const options=globalThis.document.createElement('details');options.className='gift-drive-music-options';
      const summary=globalThis.document.createElement('summary');setText(summary,message('drive.audioOptions'));options.append(summary);
      for(const child of [...musicGroup.children])if(child!==musicButton)options.append(child);
      musicGroup.append(options);
    }
    toolbar.append(musicGroup);
  }
  const updateMotionControl = () => {
    shell.dataset.motion=motion.enabled()?"on":"off";
    motionControl.setAttribute("aria-pressed", String(!motion.enabled()));
    motionControl.disabled = preference.matches;
    if (!motion.enabled()) motion.cancel();
    else {resumeCelebrations();resumeElements();}
  };
  motionControl.addEventListener("click", () => {
    motionOff = !motionOff;
    updateMotionControl();
  }, {signal:lifetime.signal});
  preference.addEventListener("change", updateMotionControl, {signal:lifetime.signal});
  updateMotionControl();
  const syncVisibility=()=>{shell.dataset.visibility=globalThis.document.hidden?'hidden':'visible';if(globalThis.document.hidden)motion.pause();else motion.resume();};
  globalThis.document.addEventListener('visibilitychange',syncVisibility,{signal:lifetime.signal});syncVisibility();
  if (mode === 'preview') shell.append(marker, stage, progress, navigation, status);
  else shell.append(stage, status);
  stage.after(pageNavigation);
  if (hasSound) shell.insertBefore(soundControl,stage);
  if (document.soundtrack || (document.schemaVersion >= 2 && (document.scenes.some(scene => scene.effects) || document.elements.some(element => element.effects || element.motions || dimensionalObject(element.props||{}) || tactilePaper(element.props||{})))))
    shell.insertBefore(toolbar, stage);
  root.replaceChildren(shell);
  const recipientPreferences=recipientContainer?.querySelector(':scope > .recipient-preferences');
  const chromeNodes=[...shell.children].filter(child=>child!==stage);
  if(recipientPreferences)chromeNodes.push(recipientPreferences);
  const syncPlayerChrome=()=>{
    if(disposed)return;
    let height=0;
    for(const child of chromeNodes){
      const css=globalThis.getComputedStyle(child);
      if(css.display==='none'||['absolute','fixed'].includes(css.position))continue;
      height+=child.getBoundingClientRect().height+(parseFloat(css.marginTop)||0)+(parseFloat(css.marginBottom)||0);
    }
    const value=`${Math.ceil(height)}px`;
    if(root.style.getPropertyValue('--gift-player-chrome')!==value)root.style.setProperty('--gift-player-chrome',value);
    if(recipientContainer)recipientContainer.style.setProperty('--gift-player-chrome',value);
  };
  const chromeObserver=globalThis.ResizeObserver?new ResizeObserver(syncPlayerChrome):null;
  for(const child of chromeNodes)chromeObserver?.observe(child);
  globalThis.addEventListener('resize',()=>relayout(),{signal:lifetime.signal});
  globalThis.visualViewport?.addEventListener('resize',()=>relayout(),{signal:lifetime.signal});
  globalThis.visualViewport?.addEventListener('scroll',()=>relayout(),{signal:lifetime.signal});
  const size = document.artboard.baseSize;
  let sceneContent;
  function syncSceneCopy() {
    const scene = document.scenes.find(s => s.id === activeSceneId);
    stage.setAttribute("aria-label", scene.name);
    sceneNavigation?.sync(document.scenes, activeSceneId);
    setText(status, mode === 'preview' ? message("gift.player.scenePosition", {
      index: document.scenes.indexOf(scene) + 1, total: document.scenes.length, name: scene.name,
    }) : '');
  }
  const render = ({ focus = true,direction=1,transitionEnabled=focus } = {}) => {
    if (disposed) return;
    sceneController?.abort();
    if(drivePlayback){audio.stop();soundtrackPlayback?.pause();}
    const signal = (sceneController = new AbortController()).signal;
    prepareSceneSound();
    stage.inert = false;
    resizeObserver?.disconnect();
    const scene = document.scenes.find((s) => s.id === activeSceneId);
    recipientContainer?.style.setProperty('--recipient-scene-background', scene.background.color);
    const family = effectPreview?.family;
    const transition = ((!family && transitionEnabled) || family === "transition") ? scene.effects?.transition : null;
    let previous;
    if (transition && motion.enabled()) {
      previous = sceneContent || globalThis.document.createElement("div");
      previous.style.backgroundColor = stage.style.backgroundColor || scene.background.color;
      if (stage.offsetHeight) previous.style.height = `${stage.offsetHeight}px`;
      for (const child of previous.children) child.removeAttribute("data-runtime-element");
    }
    sceneContent = globalThis.document.createElement("div");
    sceneContent.className = "gift-scene-content";
    stage.replaceChildren(sceneContent);
    stage.style.height='';
    stage.style.backgroundColor = scene.background.color;
    pageNavigation.hidden=true;
    applySurface(stage, scene.effects?.surface);
    const nodes = [];
    let firstContentPhoto = true;
    // Layer order changes stacking, while document order preserves reading and Tab.
    const presentation = scenePresentation(document,scene);
    const hasFooter=presentation.elements.some(isSceneFooter);
    if(hasFooter)sceneContent.classList.add('has-scene-footer');
    const bodyViewport=globalThis.document.createElement('div'),bodyCanvas=globalThis.document.createElement('div');
    bodyViewport.className='gift-scene-body';bodyCanvas.className='gift-scene-body-content';
    bodyViewport.setAttribute('role','region');setAttr(bodyViewport,'aria-label',message('gift.runtime.scrollContent'));
    bodyViewport.append(bodyCanvas);sceneContent.append(bodyViewport);
    for (const model of presentation.elements) {
      const imagePriority = firstContentPhoto && model.type === "image" &&
        Boolean(model.props?.assetId) && model.accessibility?.decorative !== true;
      if (imagePriority) firstContentPhoto = false;
      const node = renderElement(model, {
        document,
        invitation,
        imagePriority,
        assetUrl,
        mode,
        replyAdapter,
        signal, motion,
        previewFamily: family,
        onSound:(sound,options)=>{void audio.play(sound,options);},
        onAction: (actions, react) => {
          const [action] = actions;
          if(isSceneFooter(model)&&action?.targetSceneId&&turnPage(sceneDirection(document.scenes,activeSceneId,action.targetSceneId)))return;
          const event = invitation || publicInvitation(document);
          if (action?.type === 'openEventMap') {
            const url = eventMapUrl(event); if (url) globalThis.open(url, '_blank', 'noopener,noreferrer');
            return;
          }
          if (action?.type === 'saveEventCalendar') {
            const title = document.elements.find(e => e.id === 'hero-title')?.props.text || stage.getAttribute('aria-label');
            const data = eventCalendar(event, title);
            if (data) {
              const url = URL.createObjectURL(new Blob([data], { type: 'text/calendar' }));
              const link = globalThis.document.createElement('a'); link.href = url; link.download = 'momevia-invitation.ics'; link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            return;
          }
          const sourceEnvelope=model.props.preset===ENVELOPE_SOURCE_PRESET;
          if(action?.type==='replay'&&sourceEnvelope&&activeSceneId===document.entrySceneId){void react?.(signal);return;}
          if (action?.type === "replay") requestScene(document.entrySceneId, model.sound&&!sourceEnvelope ? undefined : react);
          else if (action?.targetSceneId) requestScene(action.targetSceneId, model.sound&&!sourceEnvelope ? undefined : react);
        },
      });
      node.style.zIndex = String(scene.elementIds.indexOf(model.id));
      nodes.push({ model, node });
      (isSceneFooter(model)?sceneContent:bodyCanvas).append(node);
    }
    let prose=null,pageIndex=0,layingOut=false;
    const layout = () => {
      if(layingOut)return;layingOut=true;
      try{
      if (disposed || sceneContent.hasAttribute('data-garden-opening')) return;
      syncPlayerChrome();
      const stageTop=stage.getBoundingClientRect().top;
      const children=[...shell.children];
      const after=children.slice(children.indexOf(stage)+1).reduce((sum,e)=>{const css=globalThis.getComputedStyle(e);return css.position==='absolute'?sum:sum+e.getBoundingClientRect().height+(parseFloat(css.marginTop)||0)+(parseFloat(css.marginBottom)||0);},0);
      const fitted=fittedPage({width:stage.clientWidth,authoredWidth:size.width,authoredHeight:size.height,viewportHeight:globalThis.visualViewport?.height||globalThis.innerHeight,stageTop,chromeAfter:after});
      const {scale}=fitted;
      const authoredFrame=sceneFrameLayout(presentation.elements,size,scale);
      const delta=authoredFrame.height-fitted.height;
      const frame={...authoredFrame,height:fitted.height,bodyHeight:Math.max(32,authoredFrame.bodyHeight-delta),layouts:new Map([...authoredFrame.layouts].map(([id,l])=>[id,{...l,y:l.y-delta}]))};
      const bodyNodes=nodes.filter(({model})=>!isSceneFooter(model));
      bodyCanvas.style.zoom='1';bodyCanvas.style.left='0px';
      stage.style.height=stage.style.minHeight=`${frame.height}px`;
      bodyViewport.style.height=`${frame.bodyHeight}px`;bodyCanvas.style.width=`${stage.clientWidth}px`;
      // Intentional overlaps form a cohort. Preserve every position inside it;
      // only overflow beyond its original bottom pushes later disjoint cohorts.
      for (const { model, node } of nodes) {
        if(scene.flow)node.style.transitionProperty='none';
        applyLayout(node, model, size, { responsive: true, scale });
        if (model.type === "text") {
          node.style.fontSize = responsiveTextSize(model,scale);
          node.style.height = "auto";
          node.style.minHeight='0px';
        }
        if (['reply','interaction'].includes(model.type)) node.style.minHeight = '0px';
        if (["reply", "interaction"].includes(model.type) || (model.type === "image" && model.props.caption))
          node.style.height = "auto";
        if(!isSceneFooter(model)&&['text','reply','interaction','button'].includes(model.type)&&!model.layout.rotation
          &&model.layout.x>=0&&model.layout.x<size.width)
          node.style.maxWidth=`${Math.max(0,bodyViewport.clientWidth-node.offsetLeft)}px`;
      }
      for(const {model,node}of nodes.filter(({model})=>isSceneFooter(model))){
        const box=frame.layouts.get(model.id);
        Object.assign(node.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${box.width}px`,height:`${box.height}px`,minHeight:`${box.height}px`,fontSize:responsiveControlSize(scale),lineHeight:'1.3',padding:'4px 8px'});
      }
      const finishBody=(end,minimum=frame.bodyHeight)=>{
        growReadingSurfaces(bodyNodes,scale);
        const height=Math.max(minimum,end+24);
        bodyCanvas.style.height=`${height}px`;
        const fit=bodyFit({width:stage.clientWidth,height:frame.bodyHeight,contentHeight:height});
        bodyCanvas.style.zoom=String(fit.scale);bodyCanvas.style.left=`${fit.left/fit.scale}px`;
        bodyViewport.tabIndex=-1;bodyViewport.scrollTop=0;
      };
      if (scene.flow) {
        const heights = new Map(bodyNodes.filter(({model})=>model.type==='text').map(({model,node})=>[model.id,node.scrollHeight/scale]));
        const flow = stationeryFlow(scene, presentation.elements.filter(e=>!isSceneFooter(e)), heights);
        for (const { model, node } of bodyNodes) {
          const layout = flow.layouts.get(model.id);
          if (layout) applyLayout(node, { ...model, layout }, size, { responsive: true, scale });
          if (flow.surfaces.has(model.id)) applyStationerySurface(node,scale);
        }
        const top = (bodyCanvas||stage).getBoundingClientRect().top;
        const end = Math.max(0, ...bodyNodes.filter(({model})=>!model.accessibility.decorative).map(({node})=>node.getBoundingClientRect().bottom-top));
        finishBody(end,frame.bodyHeight+flow.growth*scale);
        return;
      }
      const { actualEnd } = reflowSceneNodes(bodyNodes, scale, bodyCanvas.getBoundingClientRect().top);
      finishBody(actualEnd);
      }finally{layingOut=false;}
    };
    prose=pageChunks(nodes);
    const showPart=()=>{typewriters.forEach(finish=>finish());for(const entry of prose.entries)entry.node.textContent=entry.pages[Math.min(pageIndex,entry.pages.length-1)];
      pageNavigation.hidden=prose.count<2;pagePrevious.disabled=pageIndex===0;pageNext.disabled=pageIndex===prose.count-1;
      setText(pagePosition,message('gift.page.position',{index:pageIndex+1,total:prose.count}));layout();};
    turnPage=direction=>{if(prose.count<2||pageIndex+direction<0||pageIndex+direction>=prose.count)return false;pageIndex+=direction;showPart();return true;};
    refreshPageCopy=()=>{prose=pageChunks(nodes);pageIndex=Math.min(pageIndex,prose.count-1);showPart();};
    relayout=layout;showPart();
    layout();
    const transitionDone = sceneTransition(stage, sceneContent, previous, transition, motion, signal,{direction});
    if (transitionDone) stage.inert = true;
    resumeCelebrations = () => {};
    if (!family || family === 'ambience') {
      const target = effectPreview?.celebrationId;
      const settings = target ? { [target]: scene.effects?.celebrations?.[target] } : scene.effects?.celebrations;
      const ambience = scene.effects?.ambience;
      if (!target && ambience && !Object.hasOwn(settings || {}, ambience.id)) void playAmbience(stage, ambience, motion, signal);
      let stop = () => {};
      resumeCelebrations = () => {
        stop();
        if (!signal.aborted && !disposed) stop = playCelebrations(stage, settings, motion, signal);
      };
      resumeCelebrations();
    }
    const loopRuns=new Map();
    const loopSignal=node=>{loopRuns.get(node)?.abort();const controller=new AbortController();loopRuns.set(node,controller);return AbortSignal.any([signal,controller.signal]);};
    resumeElements=()=>{for(const {node,model}of nodes)if((model.motions || model.effects?.emphasis?.definition?.animation.iterations==='infinite')&&!signal.aborted)void playElement(node,model,motion,loopSignal(node),'emphasis');};
    for (const {node,model} of nodes) {
      if (!family || (effectPreview.elementId === model.id && ["emphasis","entrance"].includes(family))) {
        const animate = () => {
          if (signal.aborted) return;
          const elementSignal=(model.motions || model.effects?.emphasis?.definition?.animation.iterations==='infinite')?loopSignal(node):signal;
          return playElement(node, model, motion, elementSignal, family, (finish, text) => {
            typewriters.add(finish);
            skip.hidden = false;
            return () => {
              typewriters.delete(finish);
              if (typewriters.size) return;
              if (!signal.aborted && globalThis.document.activeElement === skip) {
                text.tabIndex = -1;
                text.focus({ preventScroll: true });
              }
              skip.hidden = true;
            };
          });
        };
        if (transitionDone&&!isPaperTransition(builtinPreset(transition))) void transitionDone.then(animate);
        else void animate();
      }
      if (family === "reaction" && effectPreview.elementId === model.id && model.motions?.enabled!==false) {
        const control = node.matches("button") ? node : node.querySelector("button");
        if (control) {
          if (builtinPreset(model.effects?.reaction)?.id === "R04") control.click();
          else void playReaction(model.motions?control.querySelector('[data-motion-family="reaction"]')||control:control,model.effects?.reaction,motion,signal);
        }
      }
    }
    if (globalThis.ResizeObserver) {
      resizeObserver = new ResizeObserver(layout);
      resizeObserver.observe(stage);
      resizeObserver.observe(bodyViewport);
      for (const { node, model } of nodes)
        if (["text", "reply", "interaction"].includes(model.type) || (model.type === "image" && model.props.caption))
          resizeObserver.observe(node);
    }
    syncSceneCopy();
    onSceneChange(scene.id);
    const finish = () => {
      if (signal.aborted) return;
      stage.inert = false;
      if (focus) focusVisibleTarget(stage.querySelector("h1,h2,h3,h4,h5,h6") || stage, { reduce: !motion.enabled() });
    };
    if (transitionDone) void transitionDone.then(finish);
    else finish();
  };
  function requestScene(id, react, {focus=true}={}) {
    if (!document.scenes.some((s) => s.id === id) || disposed) return;
    audio.cancelPending();
    navigationIntent?.abort();
    const intent = navigationIntent = new AbortController();
    const commit = () => {
      if (intent.signal.aborted || navigationIntent !== intent || disposed) return;
      navigationIntent = null;
      const direction=sceneDirection(document.scenes,activeSceneId,id);
      activeSceneId = id;
      render({direction,focus,transitionEnabled:true});
    };
    const reaction = react?.(intent.signal);
    if (reaction) void reaction.then(commit);
    else commit();
  }
  const goToScene = id => requestScene(id);
  render({ focus: false });
  return {
    reset() {
      goToScene(document.entrySceneId);
    },
    goToScene,
    updatePreviewCopy(localized) {
      if (disposed || mode !== "preview") return;
      document = localized;
      const elements = new Map(localized.elements.map(model => [model.id, model]));
      for (const node of stage.querySelectorAll("[data-runtime-element]")) {
        const model = elements.get(node.dataset.runtimeElement);
        if (model) updateElementCopy(node, model, localized);
      }
      syncSceneCopy();
      refreshPageCopy();
    },
    get sceneId() {
      return activeSceneId;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if(driveDocument){recipientContainer?.classList.remove('recipient-shell-drive');recipientContainer?.closest('.recipient-section')?.classList.remove('recipient-section--drive');}
      if (gardenFrame) globalThis.document.documentElement.classList.remove('has-garden-gift');
      audio.dispose();
      lifetime.abort();
      soundtrackPlayback?.dispose();
      navigationIntent?.abort();
      sceneController?.abort();
      resizeObserver?.disconnect();
      chromeObserver?.disconnect();
      root.replaceChildren();
    },
  };
}
