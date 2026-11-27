import { currentLocale, message, t } from "../../core/i18n.js";
import { createElement, registry, LIMITS } from "../../shared/canvas/index.js";
import { SOUND_TYPES } from "../../shared/canvas/sound.js";
import { interactionKinds, localEventTime } from "../../shared/canvas/interactions.js";
import { supportsMotions } from "../../shared/canvas/motion-stack.js";
import { effectsFor, elementEffectFamilies, sceneEffectFamilies, effectLabel, CELEBRATION_IDS } from "../../shared/canvas/effects.js";
import { libraryLabel as libraryText } from "../../shared/canvas/library-state.js";
import { textFont } from "../gift-runtime/renderer.js";
import { bindingLabels } from "../../shared/canvas/personalization.js";
import { PREDICTION_KIND } from "../../shared/canvas/prediction.js";
import { createPredictionFields } from "./prediction-fields.js";
import { celebrationFields } from "./celebration-fields.js";
import { motionInspector } from "./motion-inspector.js";
import { editableElement, editableSelection } from "./clipboard.js";
import { groupMembers } from "../../shared/canvas/element-groups.js";
import { groupLayout } from "./group-layout.js";
import { toPercent, imagePicker } from "./designer-helpers.js";
import { sceneThumbnail } from "./thumbnail.js";
import { catalog, isPolaroidPlaceholder } from "./library.js";
import { cropEditor } from "./crop.js";
import { buildInspectorPropertyFields, buildInspectorGeometryFields, lockInspectorControls } from "./inspector-fields.js";
import { node, button, field, input, iconButton, select } from "./dom.js";

// Panel chỉ dựng giao diện; mọi chỉnh sửa vẫn đi qua commit của Designer.
// Getter tránh giữ store, design, stage hoặc clipboard cũ sau khi tải lại nháp.
export function createInspectorPanel({
  main, getStore, getDesign, getStage, getClipboard, isQuickMode, isComposing,
  selected, selectedIds, currentScene, textOptions, isLegacyFrame, assetUrl, commit, safe,
}) {
  function effectFields(model, element) {
    const categories = element ? elementEffectFamilies : sceneEffectFamilies;
    const fields = categories.flatMap(family => {
      const preset = model.effects?.[family];
      if(family==='emphasis'&&element?.motions?.rows.length>=3&&!preset)return [];
      const options = effectsFor(family, element).filter(([id]) => !(family === 'ambience' && model.effects?.celebrations && CELEBRATION_IDS.includes(id)));
      if (preset && !options.some(([id]) => id === preset.id)) options.push([preset.id, preset.id]);
      if (!options.length) return [];
      const prefix = `effect.${family}.`;
      return [node("fieldset", { class: "editor-effect-settings" },
        node("legend", {}, family === 'ambience' && model.effects?.celebrations ? message('editor.celebrations.once') : message(`editor.effects.family.${family}`)),
        select(message("editor.interface.effects"), prefix + "id", preset?.id, [["", message("editor.interface.effectOff")], ...options.map(([id]) => [id, id === preset?.id && preset.definition ? libraryText(preset.definition.title, currentLocale()) : /^[SEATBR][0-9]{2}$/.test(id) ? message(`editor.effects.preset.${id}`) : effectLabel(id, currentLocale())])]),
        preset && family !== "surface" ? select(message("editor.interface.speed"), prefix + "speed", preset.speed || "normal",
          [["slow", message("editor.interface.slow")], ["normal", message("editor.interface.normal")], ["fast", message("editor.interface.fast")]]) : null,
        preset && family === "entrance" ? select(message("editor.interface.delay"), prefix + "delay", preset.delay || 0,
          [[0, message("editor.interface.delayImmediate")], [150, "150 ms"], [300, "300 ms"]]) : null,
        preset && family === "ambience" ? select(message("editor.interface.density"), prefix + "density", preset.density || "normal",
          [["sparse", message("editor.interface.sparse")], ["normal", message("editor.interface.normal")]]) : null,
        preset?.definition?.animation.engine === 'particles' ? field(message('editor.celebrations.loop'), node('input', {
          type: 'checkbox', checked: preset.loop === true, 'data-editor-field': prefix + 'loop',
        })) : null,
        family==='emphasis'&&preset?.definition?.animation.engine==='keyframes'?field(message('editor.celebrations.loop'),node('input',{
          type:'checkbox',checked:preset.definition.animation.iterations==='infinite','data-editor-field':prefix+'repeat',
        })):null,
        preset && (["S02", "S04"].includes(preset.id) || preset.definition?.animation.styles?.shadowBlur !== undefined) ? input(message(preset.definition?.animation.styles?.shadowBlur !== undefined ? "adminLibrary.style.shadowColor" : "editor.interface.stroke"), prefix + "color",
          preset.color || preset.definition?.animation.styles?.shadowColor || (preset.id === "S02" ? "#6D488A" : "#F3DA97"), { type: "color" }) : null,
        preset ? node("div", { class: "editor-control-row" },
          button(message("editor.interface.preview"), "effect-preview", { "data-family": family }),
          button(message("editor.interface.removeEffect"), "effect-remove", { "data-family": family })) : null,
      )];
    });
    if (!element) fields.push(celebrationFields(model));
    return [node('details', { class: 'editor-effects-disclosure',
      ...(main.querySelector('.editor-effects-disclosure')?.open ? { open: '' } : {}),
    }, node('summary', {}, message('editor.interface.effects')), ...fields)];
  }
  function interactionFields(model) {
    const p = model.props, spec = interactionKinds[p.kind], doc = getStore().get().document;
    const fields = [input(message("editor.interface.blockBackground"), "props.color", p.color, { type: "color" })];
    if (p.kind === 'light-a-candle') fields.push(select(message('interactive.candleAppearance'),'props.appearance',p.appearance || 'classic',[['classic',message('interactive.candleClassic')],['cake-overlay-v1',message('interactive.candleOverlay')],['cake-photo-v2',message('interactive.candlePhoto')]]));
    if(p.kind==='foldout-letter')fields.push(select(message('interactive.foldPaper'),'props.appearance',p.appearance || 'classic',[['classic',message('interactive.foldClassic')],['paper-fold-v2',message('interactive.foldPaper')]]));
    if (p.kind === PREDICTION_KIND) return [...fields, createPredictionFields(model, 'inspector')];
    for (const [i, entry] of (p.entries || []).entries()) {
      fields.push(input(message(`editor.interactionField.${p.kind}.${i}.0`), `entry.${i}.heading`, entry.heading, { maxlength: 120 }));
      if (spec.fields[i][1]) fields.push(field(message(`editor.interactionField.${p.kind}.${i}.1`), node("textarea", {
        "data-editor-field": `entry.${i}.body`, maxlength: LIMITS.text, rows: 3,
      }, entry.body)));
    }
    for (const [i, action] of (model.actions || []).entries())
      fields.push(select(message("editor.interface.doorTarget", { index: i + 1 }), `door.${i}`, action.targetSceneId,
        [["", message("editor.interface.chooseScene")], ...doc.scenes.map(scene => [scene.id, scene.name])]));
    for (const [i, photo] of (p.photos || []).entries()) {
      const labelKey = p.kind === "photo-comparison"
        ? `editor.interface.${i ? 'photoAfter' : 'photoBefore'}` : "editor.interface.photoNumber";
      const label = message(labelKey, p.kind === "photo-comparison" ? undefined : { index: i + 1 });
      const picture = createElement("image", {
        id: photo.id, layout: model.layout,
        props: { assetId: photo.assetId, focalPoint: photo.focalPoint }, accessibility: { alt: photo.alt }
      });
      const editPhoto = edit => commit(({ document }) => {
        const slot = document.elements.find(item => item.id === model.id)?.props.photos.find(item => item.id === photo.id);
        if (slot) edit(slot);
      }, t("editor.history.editPhotoSlot"));
      fields.push(node("fieldset", { class: "editor-interaction-photo" }, node("legend", {}, label),
        imagePicker(message(photo.assetId ? "editor.interface.replaceNamedPhoto" : "editor.interface.chooseNamedPhoto", {
          name: { format: "message", key: labelKey, params: { index: i + 1 } },
        }), photo.id),
        doc.assets.length ? select(message("editor.interface.photoUploaded"), `slot.${photo.id}.assetId`, photo.assetId,
          [["", message("editor.interface.photoMissing")], ...doc.assets.map(({ assetId }, index) => [assetId, message("editor.interface.assetNumber", { index: index + 1 })])]) : null,
        input(message("editor.interface.photoAlt"), `slot.${photo.id}.alt`, photo.alt, { maxlength: LIMITS.accessibilityText }),
        field(message("editor.interface.caption"), node("textarea", { "data-editor-field": `slot.${photo.id}.caption`, maxlength: LIMITS.text, rows: 2 }, photo.caption)),
        photo.assetId ? cropEditor(picture, {
          document: doc, assetUrl,
          editable: !getDesign().policy?.lockedElements?.[model.id],
          onChange: safe(point => { editPhoto(slot => { slot.focalPoint = point; }); renderInspector(); }),
          onPreview: () => { },
        }) : null,
        node("div", { class: "editor-layout-fields" },
          ...["x", "y"].map((axis, index) => input(message(index ? "editor.interface.crop.vertical" : "editor.interface.crop.horizontal"),
            `slot.${photo.id}.${axis}`, toPercent(photo.focalPoint[axis]), { type: "number", min: 0, max: 100, step: .1 }))),
      ));
    }
    if (spec.clock) {
      if (Object.hasOwn(p, 'clockMode')) fields.push(select(message('templates.story.dateMode'), 'props.clockMode', p.clockMode,
        [['countdown', message('templates.story.countdown')], ['elapsed', message('templates.story.elapsed')]]));
      const zones = new Set(["Asia/Ho_Chi_Minh", "UTC", p.timeZone, ...Intl.supportedValuesOf("timeZone")]);
      fields.push(select(message("editor.interface.timezone"), "props.timeZone", p.timeZone, [...zones].map(zone => [zone, zone])),
        input(message("editor.interface.eventAt"), "event-time", p.eventAt ? localEventTime(p.eventAt, p.timeZone) : "", { type: "datetime-local" }));
    }
    if (Object.hasOwn(p, 'autoplay')) fields.push(field(message('templates.story.autoplay'), node('input', { type: 'checkbox', checked: p.autoplay, 'data-editor-field': 'props.autoplay' })));
    return fields;
  }
  function renderInspector() {
    const host = main.querySelector(".editor-inspector");
    if (!host || isComposing()) return;
    const quickMode = isQuickMode();
    if (quickMode) {
      host.replaceChildren();
      return;
    }
    const store = getStore(), design = getDesign();
    const element = selected(),
      scene = currentScene();
    const previousField = host.contains(document.activeElement) ? document.activeElement.dataset.editorField : null;
    const keepGeometry = host.dataset.modelId === element?.id && host.querySelector(".editor-geometry")?.open;
    const policy = design.policy?.lockedElements?.[element?.id];
    host.dataset.modelId = element?.id || "";
    const children = [
      node(
        "div",
        { class: "editor-panel-heading" },
        node(
          "h2",
          {},
          element ? element.name || registry[element.type].label : message("editor.interface.sceneEdit"),
        ),
        iconButton(message("editor.interface.closeInspector"), "close-sheet", "close", { class: "editor-sheet-close" }),
      ),
    ];
    if (!element) {
      children.push(
        input(message("editor.interface.sceneName"), "scene.name", scene.name, { maxlength: 100 }),
        input(message("editor.interface.background"), "scene.color", scene.background.color, {
          type: "color",
        }),
        ...effectFields(scene),
      );
    } else {
      const { props } = element;
      children.push(
        input(message("editor.interface.layerName"), "element.name", element.name || "", {
          maxlength: 100,
        }),
        element.type === "image" ? imagePicker(message(props.assetId ? "editor.interface.replacePhoto" : "editor.interface.choosePhoto")) : null,
      );
      if (element.type === "text") {
        children.push(
          select(message("editor.interface.content"), "textBinding", props.textBinding || "", [
            ["", message("editor.interface.customText")],
            ...Object.entries(bindingLabels),
          ]),
        );
        if (!props.textBinding)
          children.push(
            field(
              message("editor.interface.text"),
              node(
                "textarea",
                { "data-editor-field": "props.text", rows: 4, maxlength: LIMITS.text },
                props.text || "",
              ),
            ),
          );
        else
          children.push(
            node(
              "p",
              { class: "editor-help" },
              message("editor.interface.linkedField", { field: { format: "message", key: `editor.binding.${props.textBinding}` } }),
            ),
          );
        if (!props.textBinding && design.policy?.kind !== 'creator-template') children.push(button(message('recipient.insert'), 'insert-recipient'));
        children.push(
          textOptions(element) ? button(message("editor.interface.editOnCard"), "inline-text") : null,
          node("div", { class: "editor-font-options", role: "group", "aria-label": message("editor.interface.fontStyle") },
            ...["body", "heading", "serif"].map(token => {
              const sample = node("span", { "aria-hidden": "true" }, "Aa");
              sample.style.fontFamily = textFont(token);
              const control = button("", "text-font", {
                "data-font": token, "aria-label": message("editor.interface.fontNamed", { name: { format: "message", key: `editor.interface.font.${token}` } }),
                "aria-pressed": (props.fontToken || "body") === token,
              });
              control.append(sample, node("span", {}, message(`editor.interface.font.${token}`)));
              return control;
            })),
          input(message("editor.interface.fontSize"), "props.fontSize", props.fontSize, {
            type: "number",
            min: 10,
            max: 160,
          }),
          input(message("editor.interface.lineHeight"), "props.lineHeight", props.lineHeight ?? 1.4, {
            type: "number", min: 1, max: 3, step: 0.05,
          }),
          node("div", { class: "editor-control-row", role: "group", "aria-label": message("editor.interface.textAlign") },
            ...["left", "center", "right"].map(align =>
              iconButton(message("editor.interface.alignNamed", { name: { format: "message", key: `editor.interface.align.${align}` } }), "text-align", `align-${align}`, {
                "data-align": align, "aria-pressed": props.align === align,
              }))),
        );
      }
      if (element.type === "interaction") children.push(...interactionFields(element));
      if(SOUND_TYPES.includes(element.type)&&!element.locked&&!policy&&design.policy?.kind!=='creator-template')children.push(node('h3',{},message('sfx.onPress')),button(message(element.sound?'sfx.replace':'sfx.open'),'sound-picker'),element.sound?node('p',{class:'editor-help'},message(element.sound.kind==='library'?'sfx.library':'sfx.personal')):null);
      children.push(...buildInspectorPropertyFields(element));
      if (element.type === "image") {
        const focal = props.focalPoint || { x: 0.5, y: 0.5 };
        children.push(
          field(
            message("editor.interface.photoAlt"),
            node("textarea", {
              "data-editor-field": "accessibility.alt", rows: 2, maxlength: LIMITS.accessibilityText,
              disabled: Boolean(element.accessibility.decorative),
              value: element.accessibility.alt || "",
            }),
          ),
          node("label", { class: "editor-checkbox" }, node("input", {
            type: "checkbox", "data-editor-field": "accessibility.decorative",
            checked: Boolean(element.accessibility.decorative),
          }), message("editor.interface.decorativePhoto")),
          props.assetId ? cropEditor(element, {
            document: store.get().document,
            assetUrl,
            editable: !policy || policy.editableProps.includes("focalPoint"),
            onPreview: point => getStage().previewFocal(element.id, point),
            onChange: safe(point => {
              commit(({ document }) => {
                const image = document.elements.find(item => item.id === element.id);
                if (image?.type === "image") image.props.focalPoint = point;
              }, t("editor.history.editFocalPoint"));
              renderInspector();
            }),
          }) : null,
          props.assetId && !policy ? node("p", { class: "editor-help" }, message("editor.interface.cropHint")) : null,
          node("div", { class: "editor-layout-fields" },
            input(message("editor.interface.crop.horizontal"), "crop.x", toPercent(focal.x), { type: "number", min: 0, max: 100, step: 0.1, "aria-label": message("editor.interface.crop.focusX") }),
            input(message("editor.interface.crop.vertical"), "crop.y", toPercent(focal.y), { type: "number", min: 0, max: 100, step: 0.1, "aria-label": message("editor.interface.crop.focusY") })),
          button(message("editor.interface.cropReset"), "crop-reset"),
        );
      }
      if (isPolaroidPlaceholder(element)) {
        children.push(imagePicker(message("editor.interface.polaroidAdd")),
          node("p", { class: "editor-help" }, message("editor.interface.polaroidHelp")));
      }
      if (isLegacyFrame(element)) {
        children.push(field(message("editor.interface.addFramePhoto"), node('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', 'data-editor-field': 'upload' })), node("p", { class: "editor-help" }, message("editor.interface.addFrameHint")));
      }
      if (registry[element.type].actions.length) {
        const action = element.actions?.[0];
        children.push(
          select(message("editor.interface.interaction"), "action.type", action?.type || "goToScene", [
            ["goToScene", message("editor.interface.nextScene")],
            ["replay", message("editor.interface.replay")],
          ]),
        );
        if (action?.type !== "replay") {
          const doc = store.get().document;
          const destination = doc.scenes.find(scene => scene.id === action?.targetSceneId);
          children.push(node("details", { class: "editor-target-picker" },
            node("summary", {}, destination ? message("editor.interface.targetScene", { name: destination.name }) : message("editor.interface.chooseTarget")),
            node("div", { class: "editor-target-scenes" }, ...doc.scenes.map(scene => {
              const choice = button("", "action-target", {
                "data-id": scene.id,
                "aria-pressed": scene.id === destination?.id,
              });
              choice.append(sceneThumbnail(doc, scene, { width: 28, assetUrl }), node("span", {}, scene.name));
              return choice;
            }))));
          if (!destination) children.push(node("p", { class: "editor-help" },
            message("editor.interface.targetHint")));
        }
      }
      children.push(...effectFields(element, element));
      if(supportsMotions(element))children.push(motionInspector(element));
      if(element.type==='image'&&!element.motions&&element.effects?.emphasis?.definition?.animation.iterations!=='infinite'){
        const loopCard=catalog.flatMap(g=>g.items).find(b=>b.id.startsWith('natural-motion-')&&b.create()[0]?.name===element.name);
        if(loopCard)children.push(button(message('editor.celebrations.loop'),'motion-loop-enable',{'data-motion-card':loopCard.id,disabled:!editableElement(element,design.policy)}));
      }
      const members = groupMembers(store.get().document.elements, element);
      children.push(...buildInspectorGeometryFields(element, store.get().document.artboard.baseSize, {
        layout: groupLayout(members), locked: members.some(member => member.locked || design.policy?.lockedElements?.[member.id]),
      }));
    }
    if(!quickMode&&design.policy?.kind!=='creator-template'){
      const ids = selectedIds(), editable = editableSelection(store.get().document.elements, ids, design.policy);
      if (ids.length > 1 && editable.length === ids.length && editable.every(item => !item.groupId))
        children.push(button(message('editor.interface.groupLayers'), 'element-group'));
      children.push(node('div',{class:'editor-control-row'},
        button(message('editor.interface.copyElements'),'element-copy',{disabled:!editable.length,'aria-keyshortcuts':'Control+c Meta+c'}),
        button(message('editor.interface.cutElements'),'element-cut',{disabled:!editable.length,'aria-keyshortcuts':'Control+x Meta+x'}),
        button(message('editor.interface.pasteElements'),'element-paste',{disabled:!getClipboard()?.models.length,'aria-keyshortcuts':'Control+v Meta+v'})));
    }
    host.replaceChildren(...children.filter(child => child != null));
    if (keepGeometry) host.querySelector(".editor-geometry").open = true;
    if (!element && design.policy?.kind === "creator-template")
      host.querySelectorAll("[data-editor-field], [data-editor-action='effect-remove']").forEach(control => { control.disabled = true; });
    lockInspectorControls(host, policy, Boolean(textOptions(element)));
    if (previousField && !isComposing())
      host.querySelector(`[data-editor-field="${CSS.escape(previousField)}"]`)?.focus({ preventScroll: true });
  }
  return { renderInspector };
}
