import { interactionKinds } from "../../shared/canvas/interactions.js";
import { heartPieces } from "../../shared/canvas/artwork.js";

function node(tag, css, text) {
  const element = document.createElement(tag);
  if (css) element.className = css;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderInteraction(model, { mode, signal, onAction, renderPhoto, renderArt, activate }) {
  const { kind, color, entries, photos, eventAt, timeZone } = model.props;
  const spec = interactionKinds[kind];
  const root = node("section", `gift-runtime-interaction gift-runtime-${kind}`);
  root.style.backgroundColor = color;
  root.setAttribute("aria-label", spec.label);
  const live = mode === "preview" || mode === "public";
  const listen = (target, event, handle) => target.addEventListener(event, handle, { signal });
  const button = (label, action, css = "") => {
    const control = node(live ? "button" : "span", `gift-interaction-button ${css}`, label);
    if (live) {
      control.type = "button";
      listen(control, "click", event => activate(control, event, () => action(event), kind === "scene-choices"));
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
  if (kind === "flip-card") {
    const back = status(first.heading);
    let flipped = false;
    const toggle = button("Lật thẻ", () => {
      flipped = !flipped;
      back.textContent = flipped ? first.body : first.heading;
      toggle.setAttribute("aria-pressed", String(flipped));
      root.classList.toggle("is-flipped", flipped);
    });
    if (live) toggle.setAttribute("aria-pressed", "false");
    root.append(symbol(spec.icon), back, toggle);
  } else if (kind === "scene-choices") {
    root.append(...entries.map((entry, i) => button(entry.heading, () => onAction([model.actions[i]]), "gift-interaction-door")));
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
      bypass.textContent = "Đã mở";
      bypass.setAttribute("aria-disabled", "true");
    };
    const bypass = button("Mở ngay", reveal);
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
    const pages = available.length ? available : photos;
    const frame = node("figure", "gift-album-frame");
    const picture = node("div", "gift-interaction-picture");
    const caption = node("figcaption", "gift-interaction-copy");
    const indicator = status("");
    let index = 0, start;
    const setPage = target => {
      if (target < 0 || target >= pages.length) return;
      index = target;
      picture.replaceChildren(renderPhoto(pages[index]));
      caption.textContent = pages[index].caption;
      caption.hidden = !pages[index].caption;
      indicator.textContent = `Ảnh ${index+1}/${pages.length}`;
      before.setAttribute("aria-disabled", String(index === 0));
      after.setAttribute("aria-disabled", String(index === pages.length-1));
    };
    const before = button("Trước", () => setPage(index - 1));
    const after = button("Sau", () => setPage(index + 1));
    if (live) {
      listen(picture, "pointerdown", event => {
        if (event.button !== 0 || start) return;
        start = {id:event.pointerId,x:event.clientX,y:event.clientY};
        picture.setPointerCapture(event.pointerId);
      });
      listen(picture, "pointerup", event => {
        if (start?.id !== event.pointerId) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) setPage(index + (dx < 0 ? 1 : -1));
        start = null;
      });
      for (const name of ["pointercancel","lostpointercapture"])
        listen(picture, name, event => { if (start?.id === event.pointerId) start = null; });
      listen(root,"keydown",event => {
        if (!["ArrowLeft","ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        setPage(index + (event.key === "ArrowRight" ? 1 : -1));
      });
    }
    frame.append(picture,caption);
    const pager = node("div", "gift-album-controls");
    pager.append(before,indicator,after);
    root.append(frame,pager);
    setPage(0);
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
      slider.setAttribute("aria-label", "Tỷ lệ ảnh trước");
    }
    const render = value => {
      before.style.clipPath = `inset(0 ${100-value}% 0 0)`;
      divider.style.left = `${value}%`;
      slider.setAttribute("aria-valuetext", `${value}% ảnh trước, ${100-value}% ảnh sau`);
    };
    if (live) listen(slider, "input", () => render(Number(slider.value)));
    const labels = node("div", "gift-comparison-labels");
    labels.append(...photos.map((photo,i) => node("p","gift-interaction-copy",photo.caption || (i ? "Ảnh sau" : "Ảnh trước"))));
    root.append(figure,slider,labels);
    render(50);
  } else if (kind === "wish-pick") {
    const wish = status("Chọn một điều bạn muốn nhận.");
    const choices = node("div", "gift-wish-options");
    const controls = entries.map(entry => button(entry.heading, event => {
      for (const option of controls) option.setAttribute("aria-pressed", String(option === event.currentTarget));
      wish.textContent = entry.body;
    }));
    for (const option of controls) if (live) option.setAttribute("aria-pressed","false");
    choices.append(...controls);
    root.append(symbol(spec.icon),choices,wish);
  } else if (kind === "light-a-candle") {
    const candle = node("span", "gift-interaction-candle");
    const flame = node("span","gift-candle-flame");
    candle.setAttribute("aria-hidden","true");
    candle.append(flame);
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
    root.append(candle,light,wish);
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
      const piece = button(`Mảnh ${i+1}`, () => {
        if (placed.has(i)) return;
        if (placed.size === 2) { reveal(); return; }
        placed.add(i);
        piece.setAttribute("aria-pressed", "true");
        build();
        message.textContent = `Đã ghép ${placed.size}/3 mảnh.`;
      });
      if (live) piece.setAttribute("aria-pressed","false");
      return piece;
    });
    const skip = button(first.heading, reveal);
    pieces.append(...controls);
    build();
    root.append(assembled,pieces,skip,message);
  } else {
    const heading = node("h3", "", first.heading);
    const date = node("time", "gift-event-date");
    const countdown = node("p", "gift-countdown-time", "00 : 00 : 00");
    const arrival = status("");
    root.append(heading,date,countdown,arrival);
    if (eventAt && live) {
      date.dateTime = eventAt;
      date.textContent = new Intl.DateTimeFormat("vi-VN", {
        timeZone, dateStyle:"medium",timeStyle:"short",
      }).format(new Date(eventAt)) + ` · ${timeZone}`;
      let clock;
      const tick = () => {
        const seconds = Math.max(0, Math.ceil((Date.parse(eventAt) - Date.now()) / 1000));
        if (!seconds) {
          countdown.hidden = true;
          arrival.textContent = first.body;
          clearInterval(clock);
          return;
        }
        const units = [Math.floor(seconds/86400), Math.floor(seconds/3600)%24, Math.floor(seconds/60)%60, seconds%60];
        countdown.textContent = `${units[0]} ngày · ${units.slice(1).map(unit=>String(unit).padStart(2,"0")).join(":")}`;
      };
      if (Date.parse(eventAt) > Date.now()) clock = setInterval(tick, 1000);
      signal?.addEventListener("abort", () => clearInterval(clock), {once:true});
      tick();
    } else date.textContent = live ? "Chưa chọn ngày giờ hẹn" : "Ngày · Giờ · Múi giờ";
  }
  return root;
}
