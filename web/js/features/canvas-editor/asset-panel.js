import { createElement } from "../../shared/canvas/index.js";
import { message } from "../../core/i18n.js";
import { button, node } from "./dom.js";
import { thumbnail } from "./thumbnail.js";
import { bounds } from "./library.js";

// Đọc document và quyền hiện hành mỗi lần render; cache vẫn thuộc DOM của Designer.
export function createAssetPanel({ main, getDocument, getPolicy, getSelection, isQuickMode, assetUrl }) {
  function renderAssets() {
    const host = main.querySelector(".editor-assets");
    if (!host) return;
    if (isQuickMode()) {
      host.replaceChildren();
      delete host.dataset.assetIds;
      return;
    }
    const doc = getDocument();
    const images = doc.elements.filter(item => item.type === "image" && item.props.assetId);
    const assets = doc.assets;
    const policy = getPolicy();
    const canReuse = policy?.kind !== "creator-template" ||
      policy.lockedElements?.[getSelection()]?.editableProps.includes("assetId");
    const signature = JSON.stringify([assets, images, Boolean(canReuse)]);
    if (host.dataset.assetIds === signature) return;
    host.dataset.assetIds = signature;
    host.replaceChildren(
      ...assets.flatMap(({ assetId }, index) => {
        const linked = images.filter(image => image.props.assetId === assetId);
        const models = linked.length ? linked : [createElement("image", { props: { assetId } })];
        return models.map(model => {
          const control = button(message("editor.interface.usePhoto", { name: model.name || index + 1 }), "reuse-asset", {
            "data-id": assetId, class: "editor-asset-choice", disabled: !canReuse,
          });
          control.prepend(thumbnail(doc, [{ ...model, visible: true }], bounds([model]), { width: 58, height: 52, assetUrl }));
          return control;
        });
      }),
    );
    if (!assets.length)
      host.append(
        node(
          "p",
          { class: "editor-help" },
          message("editor.interface.emptyAssets"),
        ),
      );
  }
  return { renderAssets };
}
