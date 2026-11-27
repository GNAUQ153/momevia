import { coverHasRecipient, displayRecipient } from '../../shared/recipient-naming.js';
import { validateDocument, runtimeVersionFor } from "../../shared/canvas/schema.js";
import { message, setAttr, setText, t } from "../../core/i18n.js";
import { focusVisibleTarget } from "../../core/motion.js";
import { renderElement, applyLayout, updateElementCopy } from "./renderer.js";
import {NATURAL_ARTWORK_LABEL} from '../../shared/canvas/event-media.js';
import { applySurface, createMotion, playAmbience, playElement, playReaction, sceneTransition } from "./effects.js";
import { playCelebrations } from './celebrations.js';
import { createSceneNavigation } from './scene-navigation.js';
import { createSoundPlayer } from './audio.js';
import { createSoundtrackPlayback } from './soundtrack.js';
export { renderElement, applyLayout, resolveText } from "./renderer.js";

export function mountPlayer(
  root,
  {
    document: input,
    assetUrl,
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
  if (recipientContainer) {
    const size = document.artboard.baseSize;
    recipientContainer.style.setProperty('--gift-artboard-ratio', String(size.width / size.height));
    recipientContainer.style.setProperty('--gift-content-limit', `${document.responsive.desktop.maxContentWidth}px`);
  }
  let activeSceneId = effectPreview?.sceneId || document.entrySceneId,
    disposed = false,
    sceneController = null,
    resizeObserver = null,
    navigationIntent = null;
  const shell = globalThis.document.createElement("div");
  shell.className = `gift-runtime gift-runtime-mode-${mode}`;
  if (document.elements.some(e => e.type === 'sticker' && e.props.stickerId === 'originals-illustration')) shell.classList.add('gift-runtime-originals');
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
    onSelect: id => requestScene(id),
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
  let soundtrackPlayback = null;
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
      musicButton.setAttribute('aria-pressed', String(playing));
      setText(musicButton, message(playing ? 'gift.music.pause' : 'gift.music.play'));
      setText(musicStatus, error ? message('gift.music.error') : message('gift.music.optIn'));
    };
    soundtrackPlayback = createSoundtrackPlayback(document.soundtrack, { onState: syncMusic });
    syncMusic({ playing: false });
    musicButton.addEventListener('click', () => { audio.stop(); void soundtrackPlayback.toggle(); }, { signal: lifetime.signal });
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
  if (hasSound) shell.insertBefore(soundControl,stage);
  if (document.soundtrack || (document.schemaVersion >= 2 && (document.scenes.some(scene => scene.effects) || document.elements.some(element => element.effects || element.motions))))
    shell.insertBefore(toolbar, stage);
  root.replaceChildren(shell);
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
  const render = ({ focus = true } = {}) => {
    if (disposed) return;
    sceneController?.abort();
    const signal = (sceneController = new AbortController()).signal;
    prepareSceneSound();
    stage.inert = false;
    resizeObserver?.disconnect();
    const scene = document.scenes.find((s) => s.id === activeSceneId);
    recipientContainer?.style.setProperty('--recipient-scene-background', scene.background.color);
    const family = effectPreview?.family;
    const transition = ((!family && focus) || family === "transition") ? scene.effects?.transition : null;
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
    stage.style.backgroundColor = scene.background.color;
    applySurface(stage, scene.effects?.surface);
    const nodes = [];
    let firstContentPhoto = true;
    // Layer order changes stacking, while document order preserves reading and Tab.
    const sceneIds = new Set(scene.elementIds);
    for (const model of document.elements.filter((e) => sceneIds.has(e.id))) {
      if (model.visible === false) continue;
      const imagePriority = firstContentPhoto && model.type === "image" &&
        Boolean(model.props?.assetId) && model.accessibility?.decorative !== true;
      if (imagePriority) firstContentPhoto = false;
      const node = renderElement(model, {
        document,
        imagePriority,
        assetUrl,
        mode,
        replyAdapter,
        signal, motion,
        previewFamily: family,
        onSound:(sound,options)=>{if(options?.explicit && sound.kind==='audio') soundtrackPlayback?.pause(); void audio.play(sound,options);},
        onAction: (actions, react) => {
          const [action] = actions;
          if (action?.type === "replay") requestScene(document.entrySceneId, model.sound ? undefined : react);
          else if (action?.targetSceneId) requestScene(action.targetSceneId, model.sound ? undefined : react);
        },
      });
      node.style.zIndex = String(scene.elementIds.indexOf(model.id));
      nodes.push({ model, node });
      sceneContent.append(node);
    }
    const layout = () => {
      if (disposed) return;
      const scale = Math.max(0.01, stage.clientWidth / size.width);
      // Intentional overlaps form a cohort. Preserve every position inside it;
      // only overflow beyond its original bottom pushes later disjoint cohorts.
      let shift = 0,
        actualEnd = 0;
      const content = nodes
        .filter(
          ({ model }) => !["shape", "line", "sticker"].includes(model.type)&&!(model.type==='image'&&model.accessibility.decorative&&model.accessibility.label===NATURAL_ARTWORK_LABEL),
        )
        .sort((a, b) => a.model.layout.y - b.model.layout.y);
      for (const { model, node } of nodes) {
        applyLayout(node, model, size, { responsive: true, scale });
        if (model.type === "text") {
          node.style.fontSize = `${Math.max(16, (model.props.fontSize || 24) * scale)}px`;
          node.style.height = "auto";
        }
        if (["reply", "interaction"].includes(model.type) || (model.type === "image" && model.props.caption))
          node.style.height = "auto";
      }
      const cohorts = [];
      for (const item of content) {
        const { y, height } = item.model.layout;
        const previous = cohorts.at(-1);
        if (previous && y < previous.logicalEnd) {
          previous.items.push(item);
          previous.logicalEnd = Math.max(previous.logicalEnd, y + height);
        } else cohorts.push({ items: [item], logicalEnd: y + height });
      }
      const stageTop = stage.getBoundingClientRect().top;
      for (const cohort of cohorts) {
        let cohortBottom = -Infinity;
        for (const { model, node } of cohort.items) {
          const top = model.layout.y * scale + shift;
          node.style.top = `${top}px`;
          cohortBottom = Math.max(cohortBottom, node.getBoundingClientRect().bottom - stageTop);
        }
        actualEnd = Math.max(actualEnd, cohortBottom);
        shift += Math.max(0, cohortBottom - (cohort.logicalEnd * scale + shift));
      }
      stage.style.minHeight = `${Math.max(size.height * scale, actualEnd + 24)}px`;
    };
    layout();
    const transitionDone = sceneTransition(stage, sceneContent, previous, transition, motion, signal);
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
        if (transitionDone) void transitionDone.then(animate);
        else void animate();
      }
      if (family === "reaction" && effectPreview.elementId === model.id && model.motions?.enabled!==false) {
        const control = node.matches("button") ? node : node.querySelector("button");
        if (control) {
          if (model.effects?.reaction?.id === "R04") control.click();
          else void playReaction(model.motions?control.querySelector('[data-motion-family="reaction"]')||control:control,model.effects?.reaction,motion,signal);
        }
      }
    }
    if (globalThis.ResizeObserver) {
      resizeObserver = new ResizeObserver(layout);
      resizeObserver.observe(stage);
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
  function requestScene(id, react) {
    if (!document.scenes.some((s) => s.id === id) || disposed) return;
    audio.cancelPending();
    navigationIntent?.abort();
    const intent = navigationIntent = new AbortController();
    const commit = () => {
      if (intent.signal.aborted || navigationIntent !== intent || disposed) return;
      navigationIntent = null;
      activeSceneId = id;
      render();
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
    },
    get sceneId() {
      return activeSceneId;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      audio.dispose();
      lifetime.abort();
      soundtrackPlayback?.dispose();
      navigationIntent?.abort();
      sceneController?.abort();
      resizeObserver?.disconnect();
      root.replaceChildren();
    },
  };
}
