import { CANDLE_SKINS } from '../../shared/canvas/candle-skins.js';
import { eventMediaUrl } from '../../shared/canvas/event-media.js';
import { predictionResult } from '../../shared/canvas/prediction.js';
import { interactionKinds } from "../../shared/canvas/interactions.js";
import { heartPieces } from "../../shared/canvas/artwork.js";
import { message as label, setAttr, setText } from "../../core/i18n.js";

function node(tag, css, text) {
  const element = document.createElement(tag);
  if (css) element.className = css;
  if (text !== undefined) setText(element, text);
  return element;
}

export function renderInteraction(model, { mode, signal, motion, bindings, renderPhoto, renderArt, activate }) {
  const { kind, color, entries, photos, eventAt, timeZone } = model.props;
  const spec = interactionKinds[kind];
  const root = node("section", `gift-runtime-interaction gift-runtime-${kind}`);
  root.style.backgroundColor = color;
  setAttr(root, "aria-label", label(`gift.interactions.kind.${kind}`));
  if (kind === 'event-countdown' && model.props.clockMode === 'elapsed') setAttr(root, 'aria-label', label('templates.story.elapsed'));
  const live = mode === "preview" || mode === "public";
  const listen = (target, event, handle) => target.addEventListener(event, handle, { signal });
  const button = (label, action, css = "", navigation) => {
    const control = node(live ? "button" : "span", `gift-interaction-button ${css}`, label);
    if (live) {
      control.type = "button";
      listen(control, "click", event => activate(control, event, () => action?.(event), navigation));
    }
    return control;
  };
  const symbol = content => {
    const icon = node("span", "gift-interaction-icon", content);
    icon.setAttribute("aria-hidden", "true");
    return icon;
  };
  const status = text => {
    const body = node("p", "gift-interaction-copy", text);
    if (live) body.setAttribute("role", "status");
    return body;
  };
  const [first] = entries || [];
  if (kind === 'prediction-choice') {
    const p = model.props;
    let chosen = null;
    const timers = new Set();
    const clear = () => { for (const timer of timers) clearTimeout(timer); timers.clear(); };
    signal?.addEventListener('abort', clear, { once: true });
    const later = (fn, ms) => {
      if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || motion?.enabled() === false) { fn(); return; }
      const timer = setTimeout(() => { timers.delete(timer); if (!signal?.aborted) fn(); }, ms);
      timers.add(timer);
    };
    const start = () => {
      clear(); chosen = null; delete root.dataset.choice;
      root.replaceChildren(node('h3', 'gift-prediction-question', p.question));
      const options = node('div', 'gift-prediction-options');
      for (const id of ['A', 'B']) {
        const control = button(`${id} - ${p['option' + id]}`, () => {
          if (chosen !== null) return;
          chosen = id; root.dataset.choice = id;
          const result = predictionResult(p, id);
          const selected = node('h3', 'gift-prediction-chosen', label('prediction.chosen', { choice: result.chosenLabel }));
          selected.tabIndex = -1;
          const reveal = node('div', 'gift-prediction-reveal');
          reveal.setAttribute('aria-live', 'polite'); reveal.setAttribute('aria-atomic', 'false');
          root.replaceChildren(selected, reveal);
          selected.focus();
          later(() => {
            const guess = node('h3', 'gift-prediction-guessed', label('prediction.guessed', {
              sender: bindings?.senderName?.value || label('prediction.sender'), choice: result.predictedLabel,
            }));
            reveal.append(guess, node('p', 'gift-interaction-copy gift-prediction-reason', result.reason));
          }, 350);
          later(() => {
            const ending = node('div', 'gift-prediction-ending');
            ending.append(node('p', 'gift-prediction-caption', label('prediction.ending')),
              node('p', 'gift-interaction-copy', result.ending));
            reveal.append(ending);
            root.append(button(label('prediction.replay'), () => {
              start(); root.querySelector('button')?.focus();
            }, 'gift-prediction-replay'), node('p', 'gift-prediction-brand', label('prediction.brand')));
          }, 5350);
        }, 'gift-prediction-option');
        if (live && !['A', 'B'].includes(p.prediction)) control.disabled = true;
        options.append(control);
      }
      root.append(options);
    };
    start();
  } else if (kind === "flip-card") {
    const back = status(first.heading);
    let flipped = false;
    const toggle = button(label("gift.interactions.flip"), () => {
      flipped = !flipped;
      back.textContent = flipped ? first.body : first.heading;
      toggle.setAttribute("aria-pressed", String(flipped));
      root.classList.toggle("is-flipped", flipped);
    });
    if (live) toggle.setAttribute("aria-pressed", "false");
    root.append(symbol(spec.icon), back, toggle);
  } else if (kind === "scene-choices") {
    root.append(...entries.map((entry, i) => button(entry.heading, null, "gift-interaction-door", [model.actions[i]])));
  } else if (kind === "scratch-ticket") {
    const covered = node("div", "gift-scratch-area");
    const message = status(first.body);
    message.hidden = true;
    const cover = node("div", "gift-scratch-cover", first.heading);
    const scratch = node("canvas", "gift-scratch-canvas");
    scratch.width = 310;
    scratch.height = 96;
    scratch.setAttribute("aria-hidden", "true");
    covered.append(message, cover);
    if (live) covered.append(scratch);
    let open = false;
    const reveal = () => {
      if (open) return;
      open = true;
      scratch.hidden = cover.hidden = true;
      message.hidden = false;
      message.removeAttribute("aria-hidden");
      setText(bypass, label("gift.interactions.opened"));
      bypass.setAttribute("aria-disabled", "true");
    };
    const bypass = button(label("gift.interactions.openNow"), reveal);
    if (live) {
      const brush = scratch.getContext("2d");
      brush.fillStyle = "#81649b";
      brush.fillRect(0, 0, scratch.width, scratch.height);
      brush.globalCompositeOperation = "destination-out";
      let pointer, previous;
      const erased = new Set();
      const draw = event => {
        const rect = scratch.getBoundingClientRect();
        const point = [(event.clientX - rect.left) * scratch.width / rect.width, (event.clientY - rect.top) * scratch.height / rect.height];
        brush.lineWidth = 38;
        brush.lineCap = "round";
        brush.beginPath();
        brush.moveTo(...(previous || point));
        brush.lineTo(point[0]+.1,point[1]);
        brush.stroke();
        previous = point;
        erased.add(`${Math.floor(point[0]/25)}-${Math.floor(point[1]/25)}`);
        if (erased.size >= 9) reveal();
      };
      listen(scratch, "pointerdown", event => {
        if (event.button !== 0 || open || pointer !== undefined) return;
        pointer = event.pointerId;
        scratch.setPointerCapture(pointer);
        cover.classList.add("is-scratching");
        message.hidden = false;
        message.setAttribute("aria-hidden", "true");
        draw(event);
      });
      listen(scratch, "pointermove", event => { if (pointer === event.pointerId && !open) draw(event); });
      for (const name of ["pointerup","pointercancel","lostpointercapture"])
        listen(scratch, name, event => { if (event.pointerId === pointer) { pointer = undefined; previous = null; } });
    }
    root.append(covered, bypass);
  } else if (kind === "foldout-letter") {
    if(model.props.appearance==='paper-fold-v2'){root.classList.add('gift-paper-fold-v2');root.style.setProperty('--gift-letter-paper',color); }
    for (const [index, entry] of entries.entries()) {
      const fold = node(live ? "details" : "div", "gift-letter-fold");
      const label = node(live ? "summary" : "span", "", entry.heading);
      fold.append(label);
      if (live || index === 0) fold.append(node("p", "gift-interaction-copy", entry.body));
      if (index === 0 && live) fold.open = true;
      root.append(fold);
    }
  } else if (kind === "swipe-album") {
    const available = photos.filter(photo => photo.assetId);
    const pages = available.length ? available : model.props.optional ? [photos[0]] : photos;
    if (model.props.optional) root.classList.add('gift-album-story');
    const frame = node("figure", "gift-album-frame");
    const picture = node("div", "gift-interaction-picture");
    const caption = node("figcaption", "gift-interaction-copy");
    const indicator = status("");
    let index = 0, start, pageMotion;
    signal?.addEventListener('abort',()=>pageMotion?.abort(),{once:true});
    const setPage = (target, automatic = false) => {
      if (target < 0 || target >= pages.length) return;
      const changed=target!==index,direction=target>index?1:-1;pageMotion?.abort();
      index = target;
      root.dataset.albumIndex = String(index);
      picture.replaceChildren(!available.length && model.props.optional
        ? node('p', 'gift-album-empty', label('gift.interactions.albumEmpty')) : renderPhoto(pages[index]));
      if(changed&&motion?.enabled()){
        const controller=pageMotion=new AbortController(),img=picture.querySelector('img');
        const play=()=>{if(signal?.aborted||controller.signal.aborted)return;void motion.run(picture,automatic?[{transform:'perspective(700px) rotateY(-12deg) scale(.98)',opacity:.55},{transform:'perspective(700px) rotateY(0deg) scale(1)',opacity:1}]:[{transform:`translateX(${direction*9}px)`,opacity:.55},{transform:'translateX(0px)',opacity:1}],{duration:automatic?420:240},controller.signal);};
        if(img&&!img.complete)img.decode().then(()=>{if(picture.contains(img))play();}).catch(()=>{});else play();
      }
      caption.textContent = pages[index].caption;
      caption.hidden = !pages[index].caption;
      setText(indicator, label("gift.interactions.albumPage", { index: index + 1, total: pages.length }));
      before.setAttribute("aria-disabled", String(index === 0));
      after.setAttribute("aria-disabled", String(index === pages.length-1));
    };
    let playing = false, clock;
    const preference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    const syncPlay = () => {
      if (!play) return;
      setText(play, label(playing ? 'gift.interactions.albumPause' : 'gift.interactions.albumPlay'));
      play.setAttribute('aria-pressed', String(playing));
      play.disabled = Boolean(preference?.matches);
    };
    const stop = () => { playing = false; clearInterval(clock); syncPlay(); };
    const manual = target => { stop(); setPage(target); };
    const before = button(label("catalog.pagination.prev"), () => manual(index - 1));
    const after = button(label("gift.interactions.next"), () => manual(index + 1));
    const play = model.props.autoplay ? button(label('gift.interactions.albumPlay'), () => {
      if (playing) stop(); else startPlayback();
    }, 'gift-album-play') : null;
    function startPlayback() {
      if (!live || available.length < 2 || preference?.matches || motion?.enabled() === false) return syncPlay();
      clearInterval(clock); playing = true; syncPlay();
      clock = setInterval(() => {
        if (globalThis.document.hidden || root.contains(globalThis.document.activeElement) || root.matches(':hover')) return;
        setPage((index + 1) % pages.length, true);
      }, 5000);
    }
    if (live) {
      listen(picture, "pointerdown", event => {
        if (event.button !== 0 || start) return;
        start = {id:event.pointerId,x:event.clientX,y:event.clientY};
        picture.setPointerCapture(event.pointerId);
      });
      listen(picture, "pointerup", event => {
        if (start?.id !== event.pointerId) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) manual(index + (dx < 0 ? 1 : -1));
        start = null;
      });
      for (const name of ["pointercancel","lostpointercapture"])
        listen(picture, name, event => { if (start?.id === event.pointerId) start = null; });
      listen(root,"keydown",event => {
        if (!["ArrowLeft","ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        manual(index + (event.key === "ArrowRight" ? 1 : -1));
      });
    }
    frame.append(picture,caption);
    const pager = node("div", "gift-album-controls");
    pager.append(before,indicator,after);
    root.append(frame,pager);
    if (play) { play.hidden = available.length < 2; root.append(play); }
    setPage(0);
    if (model.props.autoplay && live) {
      startPlayback();
      preference?.addEventListener('change', stop, { signal });
      const untrack = motion?.track(stop);
      signal?.addEventListener('abort', () => { stop(); untrack?.(); }, { once: true });
    }
  } else if (kind === "photo-comparison") {
    const figure = node("div", "gift-interaction-picture gift-comparison-picture");
    const after = renderPhoto(photos[1]), before = renderPhoto(photos[0]);
    const divider = node("span", "gift-comparison-divider", "↔");
    divider.setAttribute("aria-hidden","true");
    figure.append(after,before,divider);
    const slider = node(live ? "input" : "span", "gift-comparison-range");
    if (live) {
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.step = "1";
      slider.value = "50";
      setAttr(slider, "aria-label", label("gift.interactions.beforeRatio"));
    }
    const render = value => {
      before.style.clipPath = `inset(0 ${100-value}% 0 0)`;
      divider.style.left = `${value}%`;
      setAttr(slider, "aria-valuetext", label("gift.interactions.ratio", { before: value, after: 100 - value }));
    };
    if (live) listen(slider, "input", () => render(Number(slider.value)));
    const labels = node("div", "gift-comparison-labels");
    labels.append(...photos.map((photo, i) => node("p", "gift-interaction-copy", photo.caption || label(i ? "gift.interactions.afterPhoto" : "gift.interactions.beforePhoto"))));
    root.append(figure,slider,labels);
    render(50);
  } else if (kind === "wish-pick") {
    const wish = status(label("gift.interactions.chooseWish"));
    const choices = node("div", "gift-wish-options");
    const controls = entries.map(entry => button(entry.heading, event => {
      for (const option of controls) option.setAttribute("aria-pressed", String(option === event.currentTarget));
      setText(wish, entry.body);
    }));
    for (const option of controls) if (live) option.setAttribute("aria-pressed","false");
    choices.append(...controls);
    root.append(symbol(spec.icon),choices,wish);
  } else if (kind === "light-a-candle") {
    const candle = node("span", "gift-interaction-candle");
    const flame = node("span","gift-candle-flame");
    candle.setAttribute("aria-hidden","true");
    candle.append(flame);
    if(model.props.appearance==='cake-photo-v2'){
      root.classList.add('gift-cake-photo-v2');
      const skin=CANDLE_SKINS[model.props.appearance],anchor=skin.wick;
      root.style.setProperty('--gift-candle-x',`${anchor.x*100}%`);root.style.setProperty('--gift-candle-y',`${anchor.y*100}%`);
      const texture=node('img','gift-candle-texture');texture.alt='';texture.setAttribute('aria-hidden','true');
      texture.addEventListener('error',()=>{texture.remove();flame.classList.add('gift-flame-fallback');},{signal});flame.append(texture);texture.src=eventMediaUrl(skin.flameId);
    }
    const wish = status("");
    let lit = false;
    const light = button(first.heading, () => {
      if (lit) return;
      lit = true;
      candle.classList.add("is-lit");
      light.setAttribute("aria-pressed","true");
      light.setAttribute("aria-disabled","true");
      wish.textContent = first.body;
    });
    if (live) light.setAttribute("aria-pressed","false");
    if (['cake-overlay-v1','cake-photo-v2'].includes(model.props.appearance)) {
      root.classList.add('gift-cake-overlay');
      const art=node('div','gift-candle-art');art.append(candle);root.append(art,light,wish);
    } else root.append(candle,light,wish);
  } else if (kind === "heart-puzzle") {
    const pieces = node("div", "gift-heart-pieces");
    const assembled = node("div", "gift-heart-assembled");
    const message = status("");
    const placed = new Set();
    const build = () => assembled.replaceChildren(renderArt(heartPieces.map((d,i) => ({
      d, fill: placed.has(i) ? ["#A93A61","#C0517B","#88284F"][i] : "#E3AEC6",
      stroke: placed.size === 3 ? "#A93A61" : "#FFF3F8", "stroke-width": placed.size === 3 ? 1 : 3,
    }))));
    const reveal = () => {
      if (placed.size === 3) return;
      for (const [index, piece] of controls.entries()) {
        placed.add(index);
        piece.setAttribute("aria-pressed","true");
      }
      pieces.classList.add("is-complete");
      build();
      message.textContent = first.body;
      skip.setAttribute("aria-disabled","true");
    };
    const controls = Array.from({length:3}, (_, i) => {
      const piece = button(label("gift.interactions.piece", { index: i + 1 }), () => {
        if (placed.has(i)) return;
        if (placed.size === 2) { reveal(); return; }
        placed.add(i);
        piece.setAttribute("aria-pressed", "true");
        build();
        setText(message, label("gift.interactions.pieces", { count: placed.size }));
      });
      if (live) piece.setAttribute("aria-pressed","false");
      return piece;
    });
    const skip = button(first.heading, reveal);
    pieces.append(...controls);
    build();
    root.append(assembled,pieces,skip,message);
  } else {
    if (model.props.optional) root.classList.add('gift-event-story');
    const heading = node("h3", "", first.heading);
    const date = node("time", "gift-event-date");
    const countdown = node("p", "gift-countdown-time", "00 : 00 : 00");
    const arrival = status("");
    root.append(heading,date,countdown,arrival);
    if (eventAt && live) {
      date.dateTime = eventAt;
      setText(date, label("gift.interactions.eventDate", {
        date: { format: "date", value: eventAt, options: { timeZone, dateStyle: "medium", timeStyle: "short" } }, zone: timeZone,
      }));
      let clock;
      const tick = () => {
        const elapsed = model.props.clockMode === 'elapsed';
        const delta = (elapsed ? Date.now() - Date.parse(eventAt) : Date.parse(eventAt) - Date.now()) / 1000;
        const seconds = Math.max(0, elapsed ? Math.floor(delta) : Math.ceil(delta));
        if (!seconds && !elapsed) {
          countdown.hidden = true;
          arrival.textContent = first.body;
          clearInterval(clock);
          return;
        }
        const units = [Math.floor(seconds/86400), Math.floor(seconds/3600)%24, Math.floor(seconds/60)%60, seconds%60];
        setText(countdown, label("gift.interactions.countdown", {
          count: units[0], clock: units.slice(1).map(unit => String(unit).padStart(2, "0")).join(":"),
        }));
      };
      if (model.props.clockMode === 'elapsed' || Date.parse(eventAt) > Date.now()) clock = setInterval(() => { if (!globalThis.document.hidden) tick(); }, 1000);
      signal?.addEventListener("abort", () => clearInterval(clock), {once:true});
      tick();
    } else {
      if (model.props.optional) countdown.hidden = true;
      setText(date, label(model.props.optional ? 'gift.interactions.optionalDate' : live ? "gift.interactions.noDate" : "gift.interactions.datePreview"));
    }
  }
  return root;
}
