import { createLocaleControl, message, setAttr, setText, t } from "../../core/i18n.js";
import { dropCapFabricObject, bindDropCapFabricObject } from './fabric-drop-cap.js';
import { node, button } from './dom.js';
import { canFabricEdit, fabricView, fabricDiff, isOptionalEmptyPhoto } from './fabric-adapter.js';
import { arrangeFabricBoxes } from './fabric-align.js';
import { mountFabricInspector } from './fabric-inspector.js';
import { mountFabricQuickbar } from './fabric-quickbar.js';
import { mountFabricProperties } from './fabric-properties.js';
import {mountFabricShortcuts} from './fabric-shortcuts.js';
import { masks, vectorParts } from '../../shared/canvas/artwork.js';
import { eventMediaUrl } from '../../shared/canvas/event-media.js';
import { PAPER_GRAIN_URL } from '../../shared/canvas/paper-grain.js';
import {usesMotions} from '../../shared/canvas/motion-stack.js';
import { previewSvg } from '../../shared/canvas/cover-svg.js';
import { stationeryFlow, paperSlices } from '../../shared/canvas/stationery-flow.js';
import {
  canManageFabricLayer, moveFabricLayer, applyFabricWorkspacePatch,
  fabricWorkspaceChanged, snapFabricCenter, applyFabricCommands
} from './fabric-workspace.js';

// Fabric.js chỉ chạy trong dialog thiết kế. Runtime nhận quà vẫn dùng DOM để
// bảo toàn khả năng truy cập, hành động chuyển cảnh và cơ chế phản hồi hiện có.
function addTool(row, text, action) {
  const item = button(text, action, { class: 'fabric-tool' });
  row.append(item);
  return item;
}

function shapeOptions(element) {
  const { x, y, width, height, rotation } = element.layout;
  return {
    left: x + width / 2,
    top: y + height / 2,
    width,
    height,
    angle: rotation,
    originX: 'center',
    originY: 'center',
    selectable: element.editable,
    evented: element.editable,
    lockRotation: !element.editable,
    lockScalingFlip: true,
    lockSkewingX: true,
    lockSkewingY: true,
    borderColor: '#6437D6',
    cornerColor: '#6437D6',
    cornerStyle: 'circle',
    transparentCorners: false,
  };
}

function lockGroupGeometry(object) {
  object.set({ lockMovementX: true, lockMovementY: true, lockRotation: true,
    lockScalingX: true, lockScalingY: true, lockSkewingX: true, lockSkewingY: true, hasControls: false });
}

function staticPreview(fabric, model) {
  const options = shapeOptions(model);
  return new fabric.Rect({
    ...options,
    fill: '#F1ECF8',
    stroke: '#8C75AE',
    strokeWidth: 1,
    rx: 12,
    ry: 12,
    selectable: false,
    evented: false,
  });
}

function bindCaptionParts(object) {
  if (!object.momeviaCaptionGroup) return;
  // Child references must not enter Fabric's JSON enlivening graph.
  Object.defineProperties(object, {
    momeviaPhoto: { configurable: true, get: () => object.getObjects()[1] },
    momeviaCaption: { configurable: true, get: () => object.getObjects()[3] },
  });
  object.set('objectCaching', false);
}

async function makeFabricObject(fabric, model, assetUrl, signal) {
  const options = shapeOptions(model);
  const props = model.props;
  let object;
  const vector=vectorParts(model);
  if (model.assembly) {
    try {
      object = await assemblyFabricObject(fabric, model, assetUrl, signal);
    } catch {
      if (signal.aborted) return;
      object = staticPreview(fabric, model);
      object.momeviaMissingImage = true;
    }
  } else if(vector) {
    const parts=[new fabric.Rect({left:0,top:0,width:100,height:100,originX:'left',originY:'top',fill:'transparent',strokeWidth:0}),
      ...vector.map((part,i)=>{
        const path=new fabric.Path(part.d,{originX:'left',originY:'top',fill:part.fill==='none'?null:part.fill,stroke:part.stroke,strokeWidth:part['stroke-width']||0,
          strokeDashArray:part['stroke-dasharray']?.split(' ').map(Number),strokeUniform:['shape','line'].includes(model.type),strokeLineCap:'round',strokeLineJoin:'round'});
        path.momeviaFillBinding=model.artwork?.paths?.[i]?.fill==='color';path.momeviaStrokeBinding=model.artwork?.paths?.[i]?.stroke==='color';return path;
      })];
    object=new fabric.Group(parts,{...options,width:100,height:100,scaleX:options.width/100,scaleY:options.height/100});
    // SVG uses a fixed 100×100 viewBox, including paths extending into their
    // stroke. Fabric's automatic stroke bounds must not alter stored geometry.
    object.set({left:options.left,top:options.top,width:100,height:100,scaleX:options.width/100,scaleY:options.height/100});
  } else if (model.type === 'shape' && props.kind !== 'line') {
    const Shape = props.kind === 'ellipse' ? fabric.Ellipse : fabric.Rect;
    object = new Shape({
      ...options,
      ...(props.kind === 'ellipse' ? { rx: options.width / 2, ry: options.height / 2 } : { rx: props.radius || 0, ry: props.radius || 0 }),
      fill: props.color || '#DCCDFC',
      stroke: props.strokeColor || props.color || '#DCCDFC',
      strokeWidth: props.strokeWidth || 0,
    });
  } else if (model.type === 'text' && props.dropCap) {
    object = await dropCapFabricObject(fabric, model, options);
  } else if (model.type === 'text') {
    const token=props.fontToken==='serif'?'--font-serif':props.fontToken==='heading'?'--font-display':'--font-body';
    const fontFamily=getComputedStyle(document.documentElement).getPropertyValue(token).trim()||'Arial';
    const measure=document.createElement('canvas').getContext('2d');
    measure.font=`${model.accessibility?.role==='heading'?'700':'400'} ${props.fontSize||24}px ${fontFamily}`;
    const splitByGrapheme=Boolean(model.stationeryText&&(model.text||'').split(/\s+/).some(word=>measure.measureText(word).width>options.width));
    object = new fabric.Textbox(model.text ?? '', {
      ...options,
      fontFamily,
      fontWeight:model.accessibility?.role==='heading'?'700':'400',
      fontSize: props.fontSize || 24,
      lineHeight: props.lineHeight || 1.4,
      textAlign: props.align || 'left',
      fill: props.color || '#30243B',
      editable: model.textEditable,
      splitByGrapheme,
    });
    // Fabric tự đo chiều cao text; lưu chiều cao DOM theo schema gốc ở bước apply.
    object.momeviaBaseHeight = options.height;
  } else if (model.type === 'image' && props.assetId) {
    const url = assetUrl(props.assetId);
    if (typeof url === 'string' && (/^\/api\/designs\/designs\/[\w-]+\/assets\/[\w-]+$/.test(url) || url === eventMediaUrl(props.assetId))) {
      try {
        object = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous', signal });
        if (signal.aborted) { object.dispose(); return; }
        const caption = props.caption ? new fabric.Textbox(props.caption, {
          left: 6, top: 0, width: Math.max(1, options.width - 12),
          originX: 'left', originY: 'top',
          fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim() || 'Arial',
          fontSize: 15, fontWeight: 500, lineHeight: 1.35,
          fill: '#32243B', selectable: false, evented: false,
        }) : null;
        const captionHeight = caption ? Math.max(36, caption.height + 10) : 0;
        const frameHeight = caption ? Math.max(52, options.height - captionHeight) : options.height;
        const frameOptions = { ...options, height: frameHeight };
        const sourceWidth=object.width,sourceHeight=object.height;
        if(model.stationerySurface){
          const pixelRatio=2,buffer=document.createElement('canvas');buffer.width=Math.ceil(options.width*pixelRatio);buffer.height=Math.ceil(frameHeight*pixelRatio);
          const context=buffer.getContext('2d');context.scale(pixelRatio,pixelRatio);
          for(const slice of paperSlices(sourceWidth,sourceHeight,options.width,frameHeight))context.drawImage(object.getElement(),slice.sx,slice.sy,slice.sw,slice.sh,slice.x,slice.y,slice.width,slice.height);
          object.dispose();object=new fabric.FabricImage(buffer,{...frameOptions,width:buffer.width,height:buffer.height,scaleX:options.width/buffer.width,scaleY:frameHeight/buffer.height});
        }else if(props.fit==='contain'){
          const pixelScale=Math.max(1,Math.min(2,Math.max(sourceWidth/options.width,sourceHeight/options.height))),canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(options.width*pixelScale));canvas.height=Math.max(1,Math.round(frameHeight*pixelScale));
          const context=canvas.getContext('2d'),scale=Math.min(canvas.width/sourceWidth,canvas.height/sourceHeight),w=sourceWidth*scale,h=sourceHeight*scale;
          context.drawImage(object.getElement(),(canvas.width-w)*(props.focalPoint?.x??.5),(canvas.height-h)*(props.focalPoint?.y??.5),w,h);
          object.dispose();object=new fabric.FabricImage(canvas,{...frameOptions,width:canvas.width,height:canvas.height,scaleX:options.width/canvas.width,scaleY:frameHeight/canvas.height});
        }else{
        const scale=Math.max(options.width/sourceWidth,frameHeight/sourceHeight);
        const cropWidth=Math.min(sourceWidth,options.width/scale),cropHeight=Math.min(sourceHeight,frameHeight/scale);
        object.set({
          ...frameOptions,
          // Giữ kích thước ảnh gốc; scale mới đại diện đúng bố cục Momevia.
          width: cropWidth,
          height: cropHeight,
          cropX:(sourceWidth-cropWidth)*(props.focalPoint?.x??.5),
          cropY:(sourceHeight-cropHeight)*(props.focalPoint?.y??.5),
          scaleX: options.width / Math.max(1, cropWidth),
          scaleY: frameHeight / Math.max(1, cropHeight),
          objectCaching: true,
        });
        }
        const maskPath = props.mask ? props.maskPath || masks[props.mask] : null;
        {
          const clip = maskPath ? new fabric.Path(maskPath, {
            originX: 'center', originY: 'center', fill: '#000', strokeWidth: 0,
          }) : new fabric.Rect({
            width: options.width, height: frameHeight,
            originX: 'center', originY: 'center',
            rx: props.radius, ry: props.radius, strokeWidth: 0,
          });
          clip.set({
            left: maskPath ? (clip.pathOffset.x - 50) * options.width / 100 / object.scaleX : 0,
            top: maskPath ? (clip.pathOffset.y - 50) * frameHeight / 100 / object.scaleY : 0,
            scaleX: (maskPath ? options.width / 100 : 1) / object.scaleX,
            scaleY: (maskPath ? frameHeight / 100 : 1) / object.scaleY,
          });
          object.set('clipPath', clip);
        }
        if (caption) {
          // Keep the image layer as one selectable object while preserving its caption.
          // A transparent frame holds the original schema bounds on open/apply.
          object.set({ left: 0, top: 0, originX: 'left', originY: 'top', selectable: false, evented: false });
          caption.set({ top: frameHeight + 5 });
          const paper = new fabric.Rect({ left: 0, top: frameHeight, width: options.width,
            height: captionHeight, fill: '#FFF7EE', strokeWidth: 0, originX: 'left', originY: 'top' });
          const bounds = new fabric.Rect({ left: 0, top: 0, width: options.width,
            height: options.height, fill: 'transparent', strokeWidth: 0, originX: 'left', originY: 'top' });
          const displayHeight = Math.max(options.height, frameHeight + captionHeight);
          const picture = object;
          object = new fabric.Group([bounds, picture, paper, caption]);
          object.set({ ...options, top: options.top + (displayHeight - options.height) / 2,
            width: options.width, height: displayHeight, scaleX: 1, scaleY: 1, objectCaching: false });
          object.momeviaBaseHeight = options.height;
          object.momeviaDisplayOffsetY = (displayHeight - options.height) / 2;
          object.momeviaCaptionGroup = true;
          bindCaptionParts(object);
          object.layoutManager = new fabric.LayoutManager(new fabric.FixedLayout());
          // Assign child coordinates in the fixed group's centered coordinate space.
          bounds.set({ left: -options.width / 2, top: -displayHeight / 2 });
          picture.set({ left: -options.width / 2, top: -displayHeight / 2 });
          paper.set({ left: -options.width / 2, top: frameHeight - displayHeight / 2 });
          caption.set({ left: 6 - options.width / 2, top: frameHeight + 5 - displayHeight / 2 });
          for (const child of object.getObjects()) child.setCoords();
        }
      } catch {
        if (signal.aborted) return;
        // Ảnh lỗi không bao giờ được thay thế trong document gốc.
        object = staticPreview(fabric, model);
        object.momeviaMissingImage = true;
      }
    }
  }
  const coreSticker = model.type === 'sticker' && ['heart', 'star', 'flower', 'sparkles'].includes(props.stickerId);
  if(!object&&(coreSticker||['button','envelope','gift-box','reply','line'].includes(model.type)||model.type==='interaction'&&['foldout-letter','flip-card'].includes(props.kind))){
    object=await snapshotFabricElement(fabric,model,signal);object.set({selectable:false,evented:false});
  }
  object ||= staticPreview(fabric, model);
  if (model.type === 'image' && !(object instanceof fabric.FabricImage) && !(object instanceof fabric.Group)) {
    if (isOptionalEmptyPhoto(model)) {
      // Ô ảnh trống chủ động: cho phép đặt bố cục, vẫn thay ảnh bằng Inspector chính.
      object.momeviaEmptyPhoto = true;
      object.set({ selectable: model.editable, evented: model.editable, rx: props.radius || 0, ry: props.radius || 0 });
    } else object.momeviaMissingImage = true;
  }
  object.momeviaId = model.id;
  object.momeviaType = model.type;
  const surface=model.effects?.surface,styles=surface?.definition?.animation?.styles;
  if(styles?.blur&&model.type==='shape'){
    object.dispose();object=await snapshotFabricElement(fabric,model,signal,true);
    object.momeviaId=model.id;object.momeviaType=model.type;
  }
  if(styles?.shadowBlur!==undefined||surface?.id==='S01')object.set('shadow',new fabric.Shadow({color:(surface.color||styles?.shadowColor||'#352B30')+Math.round((styles?.shadowOpacity??.25)*255).toString(16).padStart(2,'0'),blur:styles?.shadowBlur??10,offsetX:styles?.shadowX??4,offsetY:styles?.shadowY??7,nonScaling:true}));
  if(styles?.blur&&model.type==='image'&&object instanceof fabric.FabricImage){object.filters.push(new fabric.filters.Blur({blur:styles.blur/32}));object.applyFilters();}
  if(styles?.texture==='paper-grain-v1'&&model.type==='shape'&&!vector){object.set('fill',await paperPattern(fabric,props.color,signal));}
  object.set('opacity', model.opacity);
  object.set('visible', !model.hidden);
  if (!model.editable) object.set({ selectable: false, evented: false });
  if (model.groupId) lockGroupGeometry(object);
  return object;
}

function fabricElementSvg(model, includeSurface = false, images = new Map()) {
  const options=shapeOptions(model),copy=structuredClone(model);
  delete copy.actions;if(!includeSurface)delete copy.effects;
  for(const key of ['editable','hidden','text','textEditable','stationerySurface','stationeryText'])delete copy[key];
  copy.elementVersion=1;copy.opacity=1;copy.layout={x:0,y:0,width:options.width,height:options.height,rotation:0};copy.accessibility={};
  if(['button','envelope','gift-box'].includes(copy.type))copy.actions=[{on:'activate',type:'replay'}];
  const version=usesMotions({elements:[copy]})?4:2;
  const assets = copy.props.assetId ? [{ assetId: copy.props.assetId, kind: 'image' }] : [];
  const doc={schemaVersion:version,registryVersion:version,artboard:{baseSize:{width:Math.max(240,options.width),height:Math.max(240,options.height)},layoutMode:'responsive-scene',safeInsets:{top:0,right:0,bottom:0,left:0}},entrySceneId:'fabric-preview',bindings:{recipientName:{type:'text',value:''},senderName:{type:'text',value:''},message:{type:'text',value:''}},assets,elements:[copy],scenes:[{id:'fabric-preview',name:'Preview',background:{kind:'solid',color:'#FFFFFF'},elementIds:[copy.id]}],responsive:{textOverflow:'expand-flow',sceneOverflow:'scroll',desktop:{maxContentWidth:600,align:'center'}}};
  return previewSvg(doc,undefined,images,{validationMode:'draft'}).replace('<rect width="100%" height="100%" fill="#FFFFFF"/>','').replace(/^<svg[^>]+>/,`<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}">`);
}

async function assemblyFabricObject(fabric, model, assetUrl, signal) {
  const images = new Map();
  for (const part of model.assembly.parts) {
    if (!part.image || images.has(part.image.mediaId)) continue;
    const id = part.image.mediaId;
    const url = assetUrl(id) || eventMediaUrl(id);
    if (!url || (url !== eventMediaUrl(id) && !/^\/api\/designs\/designs\/[\w-]+\/assets\/[\w-]+$/.test(url)))
      throw new Error('Ảnh của thành phần chưa sẵn sàng.');
    const image = await fabric.util.loadImage(url, { signal });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    images.set(id, { url: canvas.toDataURL('image/webp'), width: canvas.width, height: canvas.height });
  }
  // The shared SVG renderer retains parent transforms, rest poses and per-part clips.
  const { width, height } = model.layout;
  const svg = fabricElementSvg(model, false, images).replace(/^(<svg[^>]+>)/,
    `$1<rect width="${width}" height="${height}" fill="transparent" stroke-width="0"/>`);
  const parsed = await fabric.loadSVGFromString(svg, (element, object) => {
    if (element.getAttribute('fill') === model.props.color) object.momeviaFillBinding = true;
    if (element.getAttribute('stroke') === model.props.color) object.momeviaStrokeBinding = true;
  }, { signal });
  const object = fabric.util.groupSVGElements(parsed.objects.filter(Boolean), parsed.options);
  object.set({ ...shapeOptions(model), width, height, scaleX: 1, scaleY: 1 });
  return object;
}

async function snapshotFabricElement(fabric,model,signal,includeSurface=false){
  const options=shapeOptions(model);
  const svg=fabricElementSvg(model,includeSurface);
  const image=await fabric.FabricImage.fromURL(`data:image/svg+xml,${encodeURIComponent(svg)}`,{signal});image.set(options);return image;
}

async function paperPattern(fabric,color,signal) {
  const image=await fabric.util.loadImage(PAPER_GRAIN_URL,{signal});
  const tile=document.createElement('canvas');tile.width=tile.height=128;
  const context=tile.getContext('2d');context.fillStyle=color;context.fillRect(0,0,128,128);context.drawImage(image,0,0);
  return new fabric.Pattern({source:tile,repeat:'repeat'});
}

function reflowCaptionedPhotos(canvas, view) {
  const objects = new Map(canvas.getObjects().map(object => [object.momeviaId, object]));
  const content = view.elements.filter(model => !['shape', 'line', 'sticker'].includes(model.type))
    .sort((a, b) => a.layout.y - b.layout.y);
  const cohorts = [];
  for (const model of content) {
    const previous = cohorts.at(-1);
    const bottom = model.layout.y + model.layout.height;
    if (previous && model.layout.y < previous.bottom) {
      previous.models.push(model);
      previous.bottom = Math.max(previous.bottom, bottom);
    } else cohorts.push({ models: [model], bottom });
  }
  const growth = [];
  let shift = 0;
  for (const cohort of cohorts) {
    let overflow = 0;
    for (const model of cohort.models) {
      const object = objects.get(model.id);
      if (!object) continue;
      object.set('top', object.top + shift);
      object.momeviaDisplayOffsetY = (object.momeviaDisplayOffsetY || 0) + shift;
      if (object.momeviaCaption)
        overflow = Math.max(overflow, model.layout.y + object.height - cohort.bottom);
    }
    if (overflow > 0) {
      growth.push({ boundary: cohort.bottom, amount: overflow });
      shift += overflow;
    }
  }
  for (const model of view.elements.filter(item => ['shape', 'line', 'sticker'].includes(item.type))) {
    const object = objects.get(model.id);
    if (!object) continue;
    const offset = growth.filter(item => item.boundary <= model.layout.y).reduce((sum, item) => sum + item.amount, 0);
    // A frame spanning the photo grows with its content. Small ornaments keep their shape.
    const framesPhoto = model.type === 'shape' && model.props.kind === 'rectangle' && !model.artwork &&
      content.some(photo => objects.get(photo.id)?.momeviaCaption &&
        model.layout.x <= photo.layout.x && model.layout.x + model.layout.width >= photo.layout.x + photo.layout.width &&
        model.layout.y <= photo.layout.y && model.layout.y + model.layout.height >= photo.layout.y + photo.layout.height);
    const extra = framesPhoto ? growth.filter(item => item.boundary > model.layout.y &&
      item.boundary <= model.layout.y + model.layout.height).reduce((sum, item) => sum + item.amount, 0) : 0;
    if (extra) {
      object.momeviaBaseHeight = model.layout.height;
      object.set('height', object.height + extra);
    }
    object.set('top', object.top + offset + extra / 2);
    object.momeviaDisplayOffsetY = offset + extra / 2;
  }
  for (const object of objects.values()) object.setCoords();
}

export async function openFabricStudio({ snapshot, sceneId, policy, assetUrl, onApply, onClose = () => { }, inlineHost = null, signal }) {
  let fabric;
  try {
    fabric = await import('../../vendor/fabric.mjs');
  } catch {
    if (signal?.aborted) return;
    throw new Error(t("editor.fabric.errors.bundle"));
  }
  if (signal?.aborted) return;
  await document.fonts.ready;
  // Route có thể đã đóng trong lúc chờ font tải xong.
  if (signal?.aborted) return;
  if (!fabric.Canvas || !fabric.Rect || !fabric.Textbox) throw new Error(t("editor.fabric.errors.version"));
  if (policy?.kind === 'creator-template') throw new Error(t("editor.fabric.errors.locked"));
  // Chỉ cho nhúng Fabric vào vùng artboard của Canvas Designer, không nhúng vào trang công khai.
  const embedded = Boolean(inlineHost);
  if (embedded && (!inlineHost.isConnected || !inlineHost.closest('.editor-stage-column'))) {
    throw new Error(t("editor.fabric.errors.host"));
  }
  const view = fabricView(snapshot, sceneId, policy, { includeHidden: true });
  const scene = snapshot.scenes.find(item => item.id === sceneId);
  const layerOrder = [...scene.elementIds];
  const layerModels = new Map(scene.elementIds.map(id => [id, snapshot.elements.find(item => item.id === id)]));
  const visibility = new Map(view.elements.map(item => [item.id, !item.hidden]));
  const temporaryLocks = new Set();
  // Chọn nhiều lớp chỉ điều khiển thao tác căn chỉnh, không tạo Fabric ActiveSelection.
  const batchSelection = new Set();
  const compositionCommands=[];
  let snapEnabled = true;
  const canManage = id => canManageFabricLayer(layerModels.get(id), policy);
  const dialog = node('dialog', { class: 'editor-fabric-dialog', 'aria-label': message("editor.fabric.title") });
  if (embedded) {
    dialog.classList.add('editor-fabric-dialog--inline');
    setAttr(dialog, 'aria-label', message("editor.fabric.inline"));
    // Không cho hành động từ Fabric nổi bọt tới event delegation của Designer.
    dialog.addEventListener('click', event => event.stopPropagation());
  }
  const header = node('div', { class: 'fabric-header' },
    node('div', {},
      node('strong', {}, message("editor.fabric.badge")),
      node('p', {}, message("editor.fabric.description")),
    ),
    createLocaleControl(),
    button(message("common.actions.close"), 'fabric-close'),
  );
  const actions = node('div', { class: 'fabric-actions', role: 'toolbar', 'aria-label': message("editor.fabric.toolbar") });
  addTool(actions, message("editor.fabric.align.left"), 'align-left');
  addTool(actions, message("editor.fabric.align.center"), 'align-center');
  addTool(actions, message("editor.fabric.align.right"), 'align-right');
  addTool(actions, message("editor.fabric.align.topAction"), 'align-top');
  addTool(actions, message("editor.fabric.align.bottomAction"), 'align-bottom');
  addTool(actions, message("editor.fabric.download"), 'fabric-download');
  const snapTool = addTool(actions, message("editor.fabric.snap"), 'fabric-snap');
  snapTool.setAttribute('aria-pressed', 'true');
  const help = node('p', { class: 'fabric-help', role: 'status' }, message("editor.fabric.select"));
  const surface = node('div', { class: 'fabric-surface' }, node('canvas', { width: view.width, height: view.height }));
  const layersPanel = node('aside', { class: 'fabric-layer-panel', 'aria-label': message("editor.fabric.layers") },
    node('div', { class: 'fabric-layer-panel__heading' },
      node('strong', {}, message("editor.fabric.sceneLayers")),
      node('p', {}, message("editor.fabric.layerHint")),
    ),
    node('div', { class: 'fabric-layer-list', role: 'list', 'aria-label': message("editor.fabric.order") }),
  );
  const batchToolbar = node('div', {
    class: 'fabric-batch-toolbar', role: 'toolbar',
    'aria-label': message("editor.fabric.batch")
  });
  const batchSummary = node('p', { class: 'fabric-batch-summary', role: 'status', 'aria-live': 'polite' },
    message("editor.fabric.selectTwo"));
  const batchActions = [
    ['left', message("editor.fabric.align.left")], ['center-x', message("editor.fabric.align.horizontal")], ['right', message("editor.fabric.align.right")],
    ['top', message("editor.fabric.align.top")], ['middle', message("editor.fabric.align.vertical")], ['bottom', message("editor.fabric.align.bottom")],
    ['space-x', message("editor.fabric.align.distributeX")], ['space-y', message("editor.fabric.align.distributeY")],
  ].map(([action, label]) => addTool(batchToolbar, label, `fabric-batch-${action}`));
  batchActions.forEach(item => { item.disabled = true; });
  batchToolbar.append(button(message("editor.fabric.clear"), 'fabric-batch-clear', { class: 'fabric-batch-clear', disabled: true }));
  const layerListElement = layersPanel.querySelector('.fabric-layer-list');
  layersPanel.insertBefore(batchSummary, layerListElement);
  layersPanel.insertBefore(batchToolbar, layerListElement);
  const workspace = node('div', { class: 'fabric-workspace' },
    node('div', { class: 'fabric-stage-stack' }, surface), layersPanel);
  const footer = node('div', { class: 'fabric-footer' },
    node('span', { class: 'fabric-note' }, message("editor.fabric.saveNote")),
    button(message("editor.fabric.cancel"), 'fabric-close'),
    button(message("editor.fabric.apply"), 'fabric-apply', { class: 'editor-primary' }),
  );
  dialog.append(header, actions, help, workspace, footer);
  if (embedded) inlineHost.append(dialog);
  else document.body.append(dialog);
  let canvas;
  let inspector;
  let quickbar;
  let properties;
  let fitObserver;
  let closed = false;
  const work = new AbortController();
  const apply = footer.querySelector('[data-editor-action="fabric-apply"]');
  apply.disabled = true;
  actions.inert = true;
  function close() {
    if (dialog.open) dialog.close();
    cleanup();
  }
  function cleanup() {
    if (closed) return;
    closed = true;
    work.abort();
    signal?.removeEventListener('abort', close);
    fitObserver?.disconnect();
    inspector?.dispose();
    quickbar?.dispose();
    properties?.dispose();
    try { void canvas?.dispose()?.catch(() => {}); } catch { /* Đóng editor cũ vẫn phải thành công. */ }
    dialog.remove();
    onClose();
  }
  dialog.addEventListener('close', cleanup, { once: true });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-editor-action="fabric-close"]')) close();
  });
  signal?.addEventListener('abort', close, { once: true });
  if (embedded) dialog.addEventListener('keydown', event => {
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){
      event.preventDefault();event.stopPropagation();dialog.querySelector('[data-editor-action="fabric-apply"]:enabled')?.click();return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
      .filter(item => item.getClientRects().length);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  if (embedded) {
    dialog.show();
    dialog.querySelector('[data-editor-action="fabric-close"]')?.focus({ preventScroll: true });
  } else dialog.showModal();
  try {
    canvas = new fabric.Canvas(surface.querySelector('canvas'), {
      width: view.width,
      height: view.height,
      backgroundColor: view.background,
      preserveObjectStacking: true,
      // Tránh tạo nhóm Fabric không thể lưu trong schema Canvas v1.
      selection: false,
    });
    canvas.upperCanvasEl.tabIndex=0;
    setAttr(canvas.upperCanvasEl,'aria-label',message('editor.fabric.title'));
    canvas.on('mouse:down',()=>{if(!canvas.getActiveObject()?.isEditing)canvas.upperCanvasEl.focus({preventScroll:true});});
    if (view.effects?.surface?.definition?.animation?.styles?.texture === 'paper-grain-v1') {
      const pattern = await paperPattern(fabric, view.background, work.signal);
      if (closed || signal?.aborted) return { dialog, close };
      canvas.backgroundColor = pattern;
    }
    for (const element of view.elements) {
      const object = await makeFabricObject(fabric, { ...element, stationeryText:Boolean(scene.flow) }, assetUrl, work.signal);
      if (closed || signal?.aborted) {
        object?.dispose();
        return { dialog, close };
      }
      if (object) canvas.add(object);
    }
    apply.disabled = false;
    actions.inert = false;
    // Đồng bộ bảng layer và đối tượng Canvas, không thêm metadata lạ vào tài liệu.
    if (scene.flow) {
      const objects = new Map(canvas.getObjects().map(object => [object.momeviaId, object]));
      const heights = new Map(view.elements.filter(model=>model.type==='text').map(model=>[model.id,objects.get(model.id)?.getScaledHeight()]));
      const flow = stationeryFlow(scene, view.elements, heights);
      for (const model of view.elements) {
        const layout = flow.layouts.get(model.id), old = objects.get(model.id);
        if (!layout || !old) continue;
        const display = await makeFabricObject(fabric, { ...model, layout, stationeryText:true, stationerySurface:flow.surfaces.has(model.id) }, assetUrl, work.signal);
        if (closed || signal?.aborted) { display?.dispose(); return { dialog, close }; }
        if (!display) continue;
        if(model.type==='text')display.set('top',layout.y+Math.abs(display.height*(display.scaleY||1))/2);
        const at = canvas.getObjects().indexOf(old);
        canvas.remove(old); old.dispose(); canvas.insertAt(at, display);
        display.momeviaFlowHeightRatio = layout.height / model.layout.height;
        display.momeviaFlowOffsetY = layout.y - model.layout.y;
        // Textboxes measure their text. The authored box remains the saved geometry.
        if (model.type==='text') display.momeviaBaseHeight = model.layout.height;
      }
      view.height += flow.growth;
      canvas.setDimensions({width:view.width,height:view.height});
    } else reflowCaptionedPhotos(canvas, view);
    const byId = new Map(canvas.getObjects().map(item => [item.momeviaId, item]));
    const layerList = layersPanel.querySelector('.fabric-layer-list');
    const isMovable = id => canManage(id) && !temporaryLocks.has(id);
    const canEditContent = id => {
      const model = layerModels.get(id);
      return Boolean(model && canFabricEdit({ ...model, visible: visibility.get(id) }, policy) && !temporaryLocks.has(id));
    };
    const availableForBatch = id => isMovable(id) && visibility.get(id) !== false &&
      Boolean(byId.get(id)?.selectable) && !byId.get(id)?.momeviaMissingImage;
    const currentSelection = () => canvas.getActiveObject()?.momeviaId || null;
    // Bảng thuộc tính dùng chính đối tượng Fabric hiện tại, không tạo bản sao document.
    inspector = mountFabricInspector({
      canvas,
      artboard: { width: view.width, height: view.height },
      layerModels,
      canEdit: id => isMovable(id) && visibility.get(id) !== false,
    });
    layersPanel.insertBefore(inspector.panel, batchSummary);
    // Kiểu dáng dùng state tạm, chỉ đưa vào document khi người dùng bấm Áp dụng.
    properties = mountFabricProperties({
      canvas, layerModels, canEdit: canEditContent,
    });
    layersPanel.insertBefore(properties.panel, batchSummary);
    // Quickbar đặt cạnh artboard, chỉ điều khiển đối tượng Fabric tạm.
    quickbar = mountFabricQuickbar({
      canvas, dialog,
      artboard: { width: view.width, height: view.height },
      layerModels,
      canEdit: id => isMovable(id) && visibility.get(id) !== false,
    });
    const refreshModels=()=>{const doc=applyFabricCommands(snapshot,sceneId,compositionCommands,policy);layerModels.clear();for(const id of doc.scenes.find(s=>s.id===sceneId).elementIds)layerModels.set(id,doc.elements.find(e=>e.id===id));};
    const shortcuts=mountFabricShortcuts({dialog,canvas,fabric,signal:work.signal,canEdit:id=>isMovable(id)&&visibility.get(id)!==false,
      onCommand:command=>{
        const next=[...compositionCommands,command];applyFabricCommands(snapshot,sceneId,next,policy);compositionCommands.push(command);refreshModels();
        if(command.type==='remove'){const i=layerOrder.indexOf(command.id);if(i>=0)layerOrder.splice(i,1);visibility.delete(command.id);byId.delete(command.id);properties.setDraft(command.id,[]);}
        else {layerOrder.push(command.id);visibility.set(command.id,true);}
      },
      getState:()=>({commands:structuredClone(compositionCommands),order:[...layerOrder],visibility:[...visibility],locks:[...temporaryLocks],styles:properties.draft()}),
      restoreState:state=>{compositionCommands.splice(0,compositionCommands.length,...state.commands);layerOrder.splice(0,layerOrder.length,...state.order);visibility.clear();for(const entry of state.visibility)visibility.set(...entry);temporaryLocks.clear();for(const id of state.locks)temporaryLocks.add(id);refreshModels();byId.clear();for(const object of canvas.getObjects())byId.set(object.momeviaId,object);properties.restoreDraft(state.styles);},
      onCloneStyle:(id,fields)=>properties.setDraft(id,fields),
      refresh:()=>{
        byId.clear();
        for(const object of canvas.getObjects()){
          if (layerModels.get(object.momeviaId)?.groupId) lockGroupGeometry(object);
          bindDropCapFabricObject(fabric, object);
          bindCaptionParts(object);
          byId.set(object.momeviaId,object);
        }
        renderLayers();properties.refresh();inspector?.refresh?.();updateCaptionExport();
      },
      onSave:()=>dialog.querySelector('[data-editor-action="fabric-apply"]:enabled')?.click(),
    });
    dialog.addEventListener('fabric-shortcut-error',event=>setText(help,event.detail),{signal:work.signal});
    surface.before(quickbar.panel);
    function updateBatchTools() {
      for (const id of [...batchSelection]) {
        if (!availableForBatch(id)) batchSelection.delete(id);
      }
      const size = batchSelection.size;
      setText(batchSummary, size ? message("editor.fabric.selected", { count: size }) : message("editor.fabric.selectTwo"));
      batchActions.forEach(item => {
        const distribute = item.dataset.editorAction.endsWith('space-x') ||
          item.dataset.editorAction.endsWith('space-y');
        item.disabled = size < (distribute ? 3 : 2);
      });
      batchToolbar.querySelector('[data-editor-action="fabric-batch-clear"]').disabled = size === 0;
    }
    function renderLayers() {
      updateBatchTools();
      const active = currentSelection();
      layerList.replaceChildren(...[...layerOrder].reverse().map(id => {
        const model = layerModels.get(id);
        const shown = visibility.get(id) !== false;
        const protectedLayer = !canManage(id);
        const lockedNow = protectedLayer || temporaryLocks.has(id);
        const index = layerOrder.indexOf(id);
        const row = node('div', { class: 'fabric-layer-row', role: 'listitem' });
        if (active === id) row.classList.add('is-selected');
        if (batchSelection.has(id)) row.classList.add('is-batched');
        row.append(
          node('input', {
            type: 'checkbox', class: 'fabric-layer-multi',
            'data-fabric-multi': id, checked: batchSelection.has(id),
            disabled: !availableForBatch(id),
            'aria-label': message("editor.fabric.layer.selectForAlignment", { name: model.name || model.accessibility?.label || model.type })
          }),
          button(model.name || model.accessibility?.label || model.type, 'fabric-layer-select', {
            class: 'fabric-layer-select', 'data-layer-id': id,
            'aria-pressed': String(active === id), disabled: !canEditContent(id),
            title: model.type,
          }),
          button(shown ? message("editor.fabric.layer.hide") : message("editor.fabric.layer.show"), 'fabric-layer-visible', {
            'data-layer-id': id, 'aria-pressed': String(!shown), disabled: protectedLayer,
            title: shown ? message("editor.fabric.layer.hideTitle") : message("editor.fabric.layer.showTitle"),
          }),
          button(lockedNow ? message("editor.fabric.layer.unlockTemp") : message("editor.fabric.layer.lockTemp"), 'fabric-layer-lock', {
            'data-layer-id': id, 'aria-pressed': String(lockedNow),
            disabled: protectedLayer, title: model.groupId ? message("editor.fabric.layer.grouped") : protectedLayer ? message("editor.fabric.layer.protected") : message("editor.fabric.layer.lockHint"),
          }),
          button(message("editor.fabric.layer.up"), 'fabric-layer-up', {
            'data-layer-id': id,
            disabled: index === layerOrder.length - 1 || !isMovable(id) || !isMovable(layerOrder[index + 1]),
            'aria-label': message("editor.fabric.layer.moveUp")
          }),
          button(message("editor.fabric.layer.down"), 'fabric-layer-down', {
            'data-layer-id': id,
            disabled: index === 0 || !isMovable(id) || !isMovable(layerOrder[index - 1]),
            'aria-label': message("editor.fabric.layer.moveDown")
          }),
        );
        return row;
      }));
    }
    function refreshStack(selectedId = null) {
      canvas.discardActiveObject();
      canvas.remove(...canvas.getObjects());
      canvas.add(...layerOrder.map(id => byId.get(id)).filter(Boolean));
      const selected = byId.get(selectedId);
      if (selected && selected.visible && selected.selectable) canvas.setActiveObject(selected);
      canvas.requestRenderAll();
      renderLayers();
    }
    // Checkbox riêng giữ tương thích với chế độ selection=false của Fabric Canvas.
    layerList.addEventListener('change', event => {
      const input = event.target.closest('input[data-fabric-multi]');
      if (!input) return;
      const id = input.dataset.fabricMulti;
      if (!availableForBatch(id)) { input.checked = false; return; }
      if (input.checked) batchSelection.add(id);
      else batchSelection.delete(id);
      input.closest('.fabric-layer-row')?.classList.toggle('is-batched', input.checked);
      updateBatchTools();
    });
    canvas.on('selection:created', renderLayers);
    canvas.on('selection:updated', renderLayers);
    canvas.on('selection:cleared', renderLayers);
    canvas.on('object:moving', event => {
      const target = event.target;
      if (!snapEnabled || !target || !isMovable(target.momeviaId) || !target.getCenterPoint) return;
      const center = target.getCenterPoint();
      const next = snapFabricCenter({
        x: center.x, y: center.y,
        width: target.getScaledWidth(), height: target.getScaledHeight(),
      }, { width: view.width, height: view.height });
      if (next.snappedX || next.snappedY) {
        target.setPositionByOrigin(new fabric.Point(next.x, next.y), 'center', 'center');
        target.setCoords();
      }
    });
    renderLayers();
    const unsupported = view.elements.filter(item => !['text', 'shape', 'image'].includes(item.type) || item.props.kind === 'line');
    const missingImages = canvas.getObjects().filter(item => item.momeviaMissingImage || item.momeviaEmptyPhoto);
    const download = actions.querySelector('[data-editor-action="fabric-download"]');
    if (unsupported.length || missingImages.length) {
      download.disabled = true;
      setAttr(download, 'title', message("editor.fabric.downloadUnavailable"));
      setText(help, message("editor.fabric.downloadHint"));
    }
    let captionWarning = false;
    const updateCaptionExport = () => {
      const objects = canvas.getObjects().filter(object => object.visible);
      const content = objects.filter(object => !['shape', 'line', 'sticker'].includes(object.momeviaType));
      const overflow = objects.filter(object => object.momeviaCaption).some(object => {
        const caption = object.momeviaCaption.getBoundingRect();
        if (caption.left < 0 || caption.top < 0 || caption.left + caption.width > view.width ||
          caption.top + caption.height > view.height) return true;
        return content.some(other => {
          if (other === object) return false;
          const box = other.getBoundingRect();
          return caption.left < box.left + box.width && caption.left + caption.width > box.left &&
            caption.top < box.top + box.height && caption.top + caption.height > box.top;
        });
      });
      download.disabled = Boolean(unsupported.length || missingImages.length || overflow);
      if (overflow) {
        setAttr(download, 'title', message('editor.fabric.downloadCaptionOverflow'));
        setText(help, message('editor.fabric.downloadCaptionOverflow'));
      } else if (captionWarning && !unsupported.length && !missingImages.length) {
        download.removeAttribute('title');
        setText(help, '');
      }
      captionWarning = overflow;
    };
    updateCaptionExport();
    canvas.on('object:moving', updateCaptionExport);
    canvas.on('object:scaling', updateCaptionExport);
    canvas.on('object:modified', updateCaptionExport);
    // Chỉ thu nhỏ bằng CSS, giữ hệ tọa độ của document để Fabric Diff không bị trôi.
    const resizeFabric = () => {
      if (closed || !canvas) return;
      const available = embedded ? surface.clientWidth - 28 : window.innerWidth - 64;
      const scale = Math.min(1, Math.max(0.15, available > 0 ? available / view.width : 1));
      canvas.setDimensions({ width: view.width * scale, height: view.height * scale }, { cssOnly: true });
      surface.style.setProperty('--fabric-width', `${view.width * scale}px`);
      canvas.calcOffset();
      canvas.requestRenderAll();
    };
    resizeFabric();
    if (embedded && typeof ResizeObserver !== 'undefined') {
      fitObserver = new ResizeObserver(resizeFabric);
      fitObserver.observe(surface);
    }
    dialog.addEventListener('click', event => {
      const control = event.target.closest('[data-editor-action]');
      const action = control?.dataset.editorAction;
      const layerId = control?.dataset.layerId;
      if (action?.startsWith('fabric-layer-')) {
        if (!layerModels.has(layerId)) throw new Error('Không tìm thấy layer.');
        const layer = byId.get(layerId);
        if (!layer) throw new Error(t("editor.fabric.errors.object"));
        if (action === 'fabric-layer-select') {
          if (layer.visible && layer.selectable) {
            canvas.setActiveObject(layer);
            canvas.requestRenderAll();
            canvas.upperCanvasEl.focus({preventScroll:true});
          }
        } else if (action === 'fabric-layer-visible' && canManage(layerId)) {
          const show = visibility.get(layerId) === false;
          visibility.set(layerId, show);
          layer.set({
            visible: show, selectable: show && !temporaryLocks.has(layerId),
            evented: show && !temporaryLocks.has(layerId)
          });
          if (!show && currentSelection() === layerId) canvas.discardActiveObject();
          canvas.requestRenderAll();
        } else if (action === 'fabric-layer-lock' && canManage(layerId)) {
          if (temporaryLocks.has(layerId)) temporaryLocks.delete(layerId);
          else temporaryLocks.add(layerId);
          const editable = visibility.get(layerId) !== false && !temporaryLocks.has(layerId);
          layer.set({ selectable: editable, evented: editable });
          if (!editable && currentSelection() === layerId) canvas.discardActiveObject();
          canvas.requestRenderAll();
        } else if (action === 'fabric-layer-up' || action === 'fabric-layer-down') {
          const order = moveFabricLayer(layerOrder, layerId, action.endsWith('up') ? 'up' : 'down', isMovable);
          if (order.some((id, i) => id !== layerOrder[i])) {
            layerOrder.splice(0, layerOrder.length, ...order);
            refreshStack(layerId);
          }
        }
        renderLayers();
        return;
      }
      if (action?.startsWith('fabric-batch-')) {
        if (action === 'fabric-batch-clear') {
          batchSelection.clear();
          renderLayers();
          return;
        }
        try {
          const selectedIds = layerOrder.filter(id => batchSelection.has(id));
          const boxes = selectedIds.map(id => {
            const bounds = byId.get(id).getBoundingRect();
            return {
              id, x: bounds.left, y: bounds.top,
              width: bounds.width, height: bounds.height
            };
          });
          const changes = arrangeFabricBoxes(boxes, selectedIds,
            action.slice('fabric-batch-'.length), { canMove: availableForBatch });
          for (const { id, dx, dy } of changes) {
            const item = byId.get(id);
            item.set({ left: item.left + dx, top: item.top + dy });
            item.setCoords();
          }
          canvas.requestRenderAll();
          setText(help, changes.length ? message("editor.fabric.updated", { count: changes.length }) :
            message("editor.fabric.alreadyAligned"));
        } catch (error) {
          setText(help, error.message);
        }
        return;
      }
      if (action === 'fabric-snap') {
        snapEnabled = !snapEnabled;
        control.setAttribute('aria-pressed', String(snapEnabled));
        setText(help, message(snapEnabled ? "editor.fabric.snapOn" : "editor.fabric.snapOff"));
        return;
      }

      if (closed || !canvas) return;
      const selected = canvas.getActiveObject();
      if (action?.startsWith('align-')) {
        if (!selected?.selectable || canvas.getActiveObjects().some(object => !isMovable(object.momeviaId))) {
          setText(help, message("editor.fabric.chooseEditable"));
          return;
        }
        const width = selected.getScaledWidth();
        const height = selected.getScaledHeight();
        const left = action === 'align-left' ? width / 2 : action === 'align-center' ? view.width / 2 :
          action === 'align-right' ? view.width - width / 2 : selected.left;
        const top = action === 'align-top' ? height / 2 : action === 'align-bottom' ? view.height - height / 2 : selected.top;
        selected.set({ left, top });
        selected.setCoords();
        canvas.requestRenderAll();
      }
      if (action === 'fabric-download') updateCaptionExport();
      if (action === 'fabric-download' && !download.disabled) {
        try {
          const a = node('a', { download: 'momevia-thiep-tinh.png' });
          a.href = canvas.toDataURL({ format: 'png', multiplier: 2 });
          a.click();
        } catch { setText(help, message("editor.fabric.failedExport")); }
      }
      if (action === 'fabric-apply') {
        if(shortcuts.busy)return;
        try {
          canvas.discardActiveObject();
          // Tài liệu gốc được cập nhật metadata trước để có thể chỉnh lớp vừa hiện lại.
          const state = { order: [...layerOrder], visibility: Object.fromEntries(visibility), layouts: [],commands:structuredClone(compositionCommands) };
          const metadataDocument = applyFabricWorkspacePatch(snapshot, sceneId, state, policy);
          const layouts = fabricDiff(metadataDocument, sceneId, canvas.getObjects(), policy);
          const patch = { ...state, layouts, styles: properties.changes() };
          if (fabricWorkspaceChanged(snapshot, sceneId, patch)) onApply(patch);
          close();
        } catch (error) { setText(help, error.message); }
      }
    });
    return { dialog, close };
  } catch (error) {
    close();
    throw error;
  }
}
