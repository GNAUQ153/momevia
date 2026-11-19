import { node, button } from './dom.js';
import { fabricView, fabricDiff } from './fabric-adapter.js';
import { canManageFabricLayer, moveFabricLayer, applyFabricWorkspacePatch,
  fabricWorkspaceChanged, snapFabricCenter } from './fabric-workspace.js';

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

async function makeFabricObject(fabric, model, assetUrl) {
  const options = shapeOptions(model);
  const props = model.props;
  let object;
  if (model.type === 'shape' && props.kind !== 'line') {
    const Shape = props.kind === 'ellipse' ? fabric.Ellipse : fabric.Rect;
    object = new Shape({
      ...options,
      ...(props.kind === 'ellipse' ? { rx: options.width / 2, ry: options.height / 2 } : { rx: props.radius || 0, ry: props.radius || 0 }),
      fill: props.color || '#DCCDFC',
      stroke: props.strokeColor || props.color || '#DCCDFC',
      strokeWidth: props.strokeWidth || 0,
    });
  } else if (model.type === 'text') {
    const fontFamily = props.fontToken === 'serif' ? 'Georgia' : props.fontToken === 'heading' ? 'Arial' : 'Arial';
    object = new fabric.Textbox(model.text ?? '', {
      ...options,
      fontFamily,
      fontSize: props.fontSize || 24,
      lineHeight: props.lineHeight || 1.4,
      textAlign: props.align || 'left',
      fill: props.color || '#30243B',
      editable: model.textEditable,
    });
    // Fabric tự đo chiều cao text; lưu chiều cao DOM theo schema gốc ở bước apply.
    object.momeviaBaseHeight = options.height;
  } else if (model.type === 'image' && props.assetId) {
    const url = assetUrl(props.assetId);
    if (typeof url === 'string' && /^\/api\/designs\/designs\/[\w-]+\/assets\/[\w-]+$/.test(url)) {
      try {
        object = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        object.set({
          ...options,
          // Giữ kích thước ảnh gốc; scale mới đại diện đúng bố cục Momevia.
          width: object.width,
          height: object.height,
          scaleX: options.width / Math.max(1, object.width),
          scaleY: options.height / Math.max(1, object.height),
          objectCaching: true,
        });
      } catch {
        // Ảnh lỗi không bao giờ được thay thế trong document gốc.
        object = staticPreview(fabric, model);
        object.momeviaMissingImage = true;
      }
    }
  }
  object ||= staticPreview(fabric, model);
  if (model.type === 'image' && !(object instanceof fabric.FabricImage)) object.momeviaMissingImage = true;
  object.momeviaId = model.id;
  object.momeviaType = model.type;
  object.set('opacity', model.opacity);
  object.set('visible', !model.hidden);
  return object;
}

export async function openFabricStudio({ snapshot, sceneId, policy, assetUrl, onApply, onClose = () => {} }) {
  let fabric;
  try {
    fabric = await import('../../vendor/fabric.mjs');
  } catch {
    throw new Error('Chưa cài Fabric Studio. Chạy npm install --save-exact fabric@7.4.0 rồi npm run build.');
  }
  if (!fabric.Canvas || !fabric.Rect || !fabric.Textbox) throw new Error('Bản Fabric.js không tương thích.');
  if (policy?.kind === 'creator-template') throw new Error('Không được sửa cấu trúc của mẫu Creator đã khóa.');
  const view = fabricView(snapshot, sceneId, policy, { includeHidden: true });
  const scene = snapshot.scenes.find(item => item.id === sceneId);
  const layerOrder = [...scene.elementIds];
  const layerModels = new Map(scene.elementIds.map(id => [id, snapshot.elements.find(item => item.id === id)]));
  const visibility = new Map(view.elements.map(item => [item.id, !item.hidden]));
  const temporaryLocks = new Set();
  let snapEnabled = true;
  const canManage = id => canManageFabricLayer(layerModels.get(id), policy);
  const dialog = node('dialog', { class: 'editor-fabric-dialog', 'aria-label': 'Fabric Studio nâng cao' });
  const header = node('div', { class: 'fabric-header' },
    node('div', {},
      node('strong', {}, 'Fabric Studio · Beta'),
      node('p', {}, 'Kéo, đổi kích thước, xoay và căn chỉnh từng lớp. Mẫu tương tác vẫn mở bằng trình phát gốc.'),
    ),
    button('Đóng', 'fabric-close'),
  );
  const actions = node('div', { class: 'fabric-actions', role: 'toolbar', 'aria-label': 'Công cụ Fabric' });
  addTool(actions, 'Căn trái', 'align-left');
  addTool(actions, 'Căn giữa', 'align-center');
  addTool(actions, 'Căn phải', 'align-right');
  addTool(actions, 'Lên trên', 'align-top');
  addTool(actions, 'Xuống dưới', 'align-bottom');
  addTool(actions, 'Tải PNG tĩnh', 'fabric-download');
  const snapTool = addTool(actions, 'Căn thông minh', 'fabric-snap');
  snapTool.setAttribute('aria-pressed', 'true');
  const help = node('p', { class: 'fabric-help', role: 'status' }, 'Chọn lớp để kéo, xoay hoặc chỉnh kích thước.');
  const surface = node('div', { class: 'fabric-surface' }, node('canvas', { width: view.width, height: view.height }));
  const layersPanel = node('aside', { class: 'fabric-layer-panel', 'aria-label': 'Quản lý các lớp' },
    node('div', { class: 'fabric-layer-panel__heading' },
      node('strong', {}, 'Các lớp trong cảnh'),
      node('p', {}, 'Lớp ở trên cùng được vẽ cuối cùng. Khóa tạm chỉ áp dụng trong phiên Fabric Studio.'),
    ),
    node('div', { class: 'fabric-layer-list', role: 'list', 'aria-label': 'Thứ tự các lớp' }),
  );
  const workspace = node('div', { class: 'fabric-workspace' }, surface, layersPanel);
  const footer = node('div', { class: 'fabric-footer' },
    node('span', { class: 'fabric-note' }, 'Chỉ lưu bố cục trong Canvas Momevia. Không lưu Fabric JSON.'),
    button('Hủy', 'fabric-close'),
    button('Áp dụng vào thiết kế', 'fabric-apply', { class: 'editor-primary' }),
  );
  dialog.append(header, actions, help, workspace, footer);
  document.body.append(dialog);
  let canvas;
  let closed = false;
  function close() { if (dialog.open) dialog.close(); else cleanup(); }
  function cleanup() {
    if (closed) return;
    closed = true;
    try { void canvas?.dispose(); } catch { /* Đóng editor cũ vẫn phải thành công. */ }
    dialog.remove();
    onClose();
  }
  dialog.addEventListener('close', cleanup, { once: true });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.showModal();
  try {
    canvas = new fabric.Canvas(surface.querySelector('canvas'), {
      width: view.width,
      height: view.height,
      backgroundColor: view.background,
      preserveObjectStacking: true,
      // Tránh tạo nhóm Fabric không thể lưu trong schema Canvas v1.
      selection: false,
    });
    for (const element of view.elements) {
      if (closed) return { dialog, close };
      canvas.add(await makeFabricObject(fabric, element, assetUrl));
    }
    // Đồng bộ bảng layer và đối tượng Canvas, không thêm metadata lạ vào tài liệu.
    const byId = new Map(canvas.getObjects().map(item => [item.momeviaId, item]));
    const layerList = layersPanel.querySelector('.fabric-layer-list');
    const isMovable = id => canManage(id) && !temporaryLocks.has(id);
    const currentSelection = () => canvas.getActiveObject()?.momeviaId || null;
    function renderLayers() {
      const active = currentSelection();
      layerList.replaceChildren(...[...layerOrder].reverse().map(id => {
        const model = layerModels.get(id);
        const shown = visibility.get(id) !== false;
        const protectedLayer = !canManage(id);
        const lockedNow = protectedLayer || temporaryLocks.has(id);
        const index = layerOrder.indexOf(id);
        const row = node('div', { class: 'fabric-layer-row', role: 'listitem' });
        if (active === id) row.classList.add('is-selected');
        row.append(
          button(model.name || model.accessibility?.label || model.type, 'fabric-layer-select', {
            class: 'fabric-layer-select', 'data-layer-id': id,
            'aria-pressed': String(active === id), disabled: !shown || lockedNow,
            title: model.type,
          }),
          button(shown ? 'Ẩn' : 'Hiện', 'fabric-layer-visible', {
            'data-layer-id': id, 'aria-pressed': String(!shown), disabled: protectedLayer,
            title: shown ? 'Ẩn lớp này trên thiệp' : 'Hiện lớp trên thiệp',
          }),
          button(lockedNow ? 'Mở khóa tạm' : 'Khóa tạm', 'fabric-layer-lock', {
            'data-layer-id': id, 'aria-pressed': String(lockedNow),
            disabled: protectedLayer, title: protectedLayer ? 'Lớp đã bị khóa bởi thiết kế hoặc quyền Creator' : 'Khóa tạm thao tác',
          }),
          button('Lên', 'fabric-layer-up', { 'data-layer-id': id,
            disabled: index === layerOrder.length - 1 || !isMovable(id) || !isMovable(layerOrder[index + 1]),
            'aria-label': 'Đưa lên một lớp' }),
          button('Xuống', 'fabric-layer-down', { 'data-layer-id': id,
            disabled: index === 0 || !isMovable(id) || !isMovable(layerOrder[index - 1]),
            'aria-label': 'Đưa xuống một lớp' }),
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
    const unsupported = view.elements.filter(item => !['text','shape','image'].includes(item.type) || item.props.kind === 'line');
    const missingImages = canvas.getObjects().filter(item => item.momeviaMissingImage);
    const download = actions.querySelector('[data-editor-action="fabric-download"]');
    if (unsupported.length || missingImages.length) {
      download.disabled = true;
      download.title = 'Bản PNG không thể tái tạo đầy đủ hiệu ứng tương tác hoặc ảnh chưa tải.';
      help.textContent = 'Một số lớp tương tác chỉ hiển thị dạng minh họa. Chỉnh bố cục, rồi xem kết quả trong trình phát gốc.';
    }
    // Canvas vật lý giữ kích thước document, chỉ thu nhỏ CSS trên mobile.
    const scale = Math.min(1, Math.max(0.25, (window.innerWidth - 64) / view.width));
    canvas.setDimensions({ width: view.width * scale, height: view.height * scale }, { cssOnly: true });
    surface.style.setProperty('--fabric-width', `${view.width * scale}px`);
    canvas.requestRenderAll();
    dialog.addEventListener('click', event => {
      const control = event.target.closest('[data-editor-action]');
      const action = control?.dataset.editorAction;
      const layerId = control?.dataset.layerId;
      if (action?.startsWith('fabric-layer-')) {
        if (!layerModels.has(layerId)) throw new Error('Không tìm thấy layer.');
        const layer = byId.get(layerId);
        if (!layer) throw new Error('Không tìm thấy đối tượng trên Canvas.');
        if (action === 'fabric-layer-select') {
          if (layer.visible && layer.selectable) {
            canvas.setActiveObject(layer);
            canvas.requestRenderAll();
          }
        } else if (action === 'fabric-layer-visible' && canManage(layerId)) {
          const show = visibility.get(layerId) === false;
          visibility.set(layerId, show);
          layer.set({ visible: show, selectable: show && !temporaryLocks.has(layerId),
            evented: show && !temporaryLocks.has(layerId) });
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
      if (action === 'fabric-snap') {
        snapEnabled = !snapEnabled;
        control.setAttribute('aria-pressed', String(snapEnabled));
        help.textContent = snapEnabled ? 'Đã bật căn nhanh theo tâm và biên bản vẽ.' : 'Đã tắt căn nhanh.';
        return;
      }

      if (action === 'fabric-close') { close(); return; }
      if (closed || !canvas) return;
      const selected = canvas.getActiveObject();
      if (action?.startsWith('align-')) {
        if (!selected || !selected.selectable) { help.textContent = 'Chọn một lớp có thể chỉnh sửa trước.'; return; }
        const width = selected.getScaledWidth();
        const height = selected.getScaledHeight();
        const left = action === 'align-left' ? width / 2 : action === 'align-center' ? view.width / 2 :
          action === 'align-right' ? view.width - width / 2 : selected.left;
        const top = action === 'align-top' ? height / 2 : action === 'align-bottom' ? view.height - height / 2 : selected.top;
        selected.set({ left, top });
        selected.setCoords();
        canvas.requestRenderAll();
      }
      if (action === 'fabric-download' && !download.disabled) {
        try {
          const a = node('a', { download: 'momevia-thiep-tinh.png' });
          a.href = canvas.toDataURL({ format: 'png', multiplier: 2 });
          a.click();
        } catch { help.textContent = 'Không xuất được PNG. Kiểm tra ảnh tải lên và quyền CORS.'; }
      }
      if (action === 'fabric-apply') {
        try {
          // Tài liệu gốc được cập nhật metadata trước để có thể chỉnh lớp vừa hiện lại.
          const state = { order: [...layerOrder], visibility: Object.fromEntries(visibility), layouts: [] };
          const metadataDocument = applyFabricWorkspacePatch(snapshot, sceneId, state, policy);
          const layouts = fabricDiff(metadataDocument, sceneId, canvas.getObjects(), policy);
          const patch = { ...state, layouts };
          if (fabricWorkspaceChanged(snapshot, sceneId, patch)) onApply(patch);
          close();
        } catch (error) { help.textContent = error.message; }
      }
    });
    return { dialog, close };
  } catch (error) {
    close();
    throw error;
  }
}
