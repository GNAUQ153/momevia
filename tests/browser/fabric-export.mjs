import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";
import { chromium } from "playwright";
import { buildLibraryPreview } from "../../src/modules/designs/library-preview.mjs";
import { builtinLibraryItems } from "../../src/modules/designs/library.seed.mjs";
import { previewSvg } from "../../web/js/shared/canvas/cover-svg.js";
import { installLibrary } from "../../web/js/shared/canvas/library-state.js";
const dir = process.env.FABRIC_EXPORT_EVIDENCE || null;
const web = path.resolve("web");
const all = builtinLibraryItems();
if (dir) fs.mkdirSync(dir, { recursive: true });
installLibrary({ items: all });
const styles = fs.readFileSync("web/index.html", "utf8").match(/<link\b[^>]*rel="stylesheet"[^>]*>/gi).join("\n");
const fixture = await sharp({ create: { width: 256, height: 256, channels: 4, background: "#f000c0" } }).png().toBuffer();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 }, acceptDownloads: true });
const mime = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png" };
await ctx.route("**/*", async (route) => {
  const u = new URL(route.request().url());
  if (u.origin !== "http://audit.test") return route.abort();
  if (u.pathname === "/") return route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="vi"><meta charset="utf-8">' + styles + '<body><div id="stage"></div>' });
  if (u.pathname.startsWith("/api/designs/designs/")) return route.fulfill({ body: fixture, contentType: "image/png" });
  const p = path.resolve(web, "." + decodeURIComponent(u.pathname));
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return route.fulfill({ status: 404, body: "" });
  return route.fulfill({ path: p, contentType: mime[path.extname(p)] || "application/octet-stream" });
});
try {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://audit.test/", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    globalThis.media = (await import("/js/shared/canvas/event-media.js")).EVENT_MEDIA;
  });
  const ids = ["film-strip", "photo-diptych", "panorama-caption", "quad-album", "photo-caption", "round-portrait", "arch-photo", "heart-photo", "torn-photo", "motion-cheering-glasses", "motion-ringed-planet", "motion-finish-medal", "motion-ballerina-music-box", "motion-mini-confetti", "motion-pocket-hourglass", "natural-motion-leaf", "natural-motion-ribbon", "natural-motion-paper"];
  const result = [];
  for (const id of ids) {
    const row = all.find((x) => x.kind === "element" && x.id === id);
    if (!row) throw Error(id);
    const doc = buildLibraryPreview(row, all.slice(), "vi").document;
    const captionCase = ['film-strip','photo-diptych','panorama-caption','quad-album'].includes(id);
    for (const variant of (captionCase ? ['A','B','LONG_A','LONG_B','OVERFLOW'] : ['A','B'])) {
      let n = 0;
      for (const e of doc.elements) {
        if (e.type === "image" && e.props.caption) e.props.caption = (variant === "A" ? "Điểm hẹn A" : "Ký ức số B") + " · " + ++n;
        if (id === "photo-caption" && e.type === "text") e.props.text = variant === "A" ? "Điểm hẹn A" : "Ký ức số B";
      }
      if (variant.startsWith('LONG') || variant === 'OVERFLOW') {
        const sentence = variant === 'LONG_B'
          ? 'Ký ức số B là ngày chúng mình cùng đến thăm khu vườn đầy hoa và ngắm ánh nắng ấm áp tràn qua bên cửa sổ gỗ của ngôi nhà bên hồ.'
          : 'Điểm hẹn A là ký ức về buổi sáng chúng mình cùng bước qua khu vườn đầy hoa và kể cho nhau nghe những điều dịu dàng nhất trong ngày hôm ấy.';
        for (const model of doc.elements.filter(model=>model.type==='image'&&model.props.caption))
          model.props.caption = variant === 'OVERFLOW' ? sentence.repeat(20) : sentence;
      }
      await page.evaluate(async ({ doc: doc2, id: id2 }) => {
        const { openFabricStudio } = await import("/js/features/canvas-editor/fabric-studio.js");
        const fab = await import("/js/vendor/fabric.mjs");
        if (!globalThis.oldAdd) {
          globalThis.oldAdd = fab.Canvas.prototype.add;
          fab.Canvas.prototype.add = function(...x) {
            globalThis.canvas = this;
            return globalThis.oldAdd.apply(this, x);
          };
        }
        globalThis.tool = await openFabricStudio({
          snapshot: doc2,
          sceneId: doc2.entrySceneId,
          assetUrl: key => id2.includes('motion')
            ? '/assets/event-cards/' + globalThis.media[key]?.file
            : '/api/designs/designs/audit/assets/' + key,
          onApply: () => {},
          signal: new AbortController().signal,
        });
      }, { doc, id });
      const button = page.locator('[data-editor-action="fabric-download"]');
      const drift = await page.evaluate(async (d) => {
        const { fabricDiff } = await import("/js/features/canvas-editor/fabric-adapter.js");
        return fabricDiff(d, d.entrySceneId, globalThis.canvas.getObjects());
      }, doc);
      assert.deepEqual(drift, [], id + " opening Fabric preserves stored geometry");
      const disabled = await button.isDisabled();
      if (variant === 'OVERFLOW') {
        assert.equal(disabled,true,id+' must block a caption beyond the artboard');
        const hint = await button.getAttribute('title');
        assert.match(hint, /chú thích|caption/i);
        result.push({id,variant,disabled,hint});
        if(dir)await page.screenshot({path:dir+'/'+id+'-overflow-studio.jpg',quality:85});
        await page.evaluate(()=>globalThis.tool.close());
        continue;
      }
      assert.equal(disabled, false, id + ' export should be enabled for ' + variant);
      if (variant === 'LONG_A') {
        const blocked = await page.evaluate(() => {
          const shape = globalThis.canvas.getObjects().find(shape => shape.momeviaCaption);
          const initial = shape.scaleY;
          const download = globalThis.document.querySelector('[data-editor-action="fabric-download"]');
          shape.set('scaleY', 20);
          shape.setCoords();
          globalThis.canvas.fire('object:scaling', { target: shape });
          const disabled = download.disabled;
          shape.set('scaleY', initial);
          shape.setCoords();
          globalThis.canvas.fire('object:modified', { target: shape });
          return { disabled, recovered: !download.disabled };
        });
        assert.deepEqual(blocked,{disabled:true,recovered:true});
      }
      let hash = null, bytes = 0;
      if (!disabled) {
        const pending = page.waitForEvent("download");
        await button.click();
        const download = await pending;
        const stream = await download.createReadStream();
        const parts = [];
        for await (const chunk of stream) parts.push(chunk);
        const data = Buffer.concat(parts);
        const info = await sharp(data).metadata();
        assert.equal(info.width, doc.artboard.baseSize.width * 2);
        assert.equal(info.height, doc.artboard.baseSize.height * 2);
        if (["round-portrait", "arch-photo", "heart-photo", "torn-photo"].includes(id)) {
          const model = doc.elements.find((e) => e.type === "image");
          const pixels = await sharp(data).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          const at = (rx, ry) => {
            const x = Math.floor((model.layout.x + model.layout.width * rx) * 2);
            const y = Math.floor((model.layout.y + model.layout.height * ry) * 2);
            const i = (y * pixels.info.width + x) * pixels.info.channels;
            return [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]];
          };
          const isPhoto = (p) => p[0] > 220 && p[1] < 30 && p[2] > 170;
          assert(isPhoto(at(0.5, 0.5)), id + " center contains actual photo");
          assert(!isPhoto(at(1e-3, 1e-3)), id + " corner must be clipped away");
        }
        if (id.startsWith('motion-')) {
          const expectedSvg = previewSvg(doc, doc.entrySceneId, new Map(), {validationMode:'draft'});
          const expected = await sharp(Buffer.from(expectedSvg)).resize(195,422).removeAlpha().raw().toBuffer();
          const actual = await sharp(data).resize(195,422).removeAlpha().raw().toBuffer();
          let delta = 0;
          for (let index = 0; index < expected.length; index++) delta += Math.abs(expected[index] - actual[index]);
          const difference = delta / expected.length;
          assert(difference < 0.4, id + ' must preserve masks and rest parts; mean pixel difference ' + difference);
        }
        hash = createHash("sha256").update(data).digest("hex");
        bytes = data.length;
        if (dir) fs.writeFileSync(dir + "/" + id + "-" + variant + ".png", data);
      }
      if (dir) await page.screenshot({ path: dir + "/" + id + "-" + variant + "-studio.jpg", quality: 85 });
      result.push({ id, variant, disabled, n, hash, bytes });
      await page.evaluate(() => globalThis.tool.close());
      if (!captionCase && id !== "photo-caption") break;
    }
  }
  assert.deepEqual(errors, []);
  for (const id of ["film-strip", "photo-diptych", "panorama-caption", "quad-album", "photo-caption"]) {
    const [a, b] = result.filter((r) => r.id === id);
    assert(a && b, id);
    assert.notEqual(a.hash, b.hash, id + " caption edits must change exported PNG pixels");
  }
  for (const id of ['film-strip','photo-diptych','panorama-caption','quad-album']) {
    const [a,b]=result.filter(row=>row.id===id&&row.variant.startsWith('LONG'));
    assert(a&&b,id+' must exercise both long captions');
    assert.notEqual(a.hash,b.hash,id+' every long caption must survive PNG export');
  }
  if (dir) fs.writeFileSync(dir + '/results.json', JSON.stringify({result,errors},null,2));

  for (const id of ['heart', 'star', 'flower', 'sparkles', 'balloon', 'cake', 'gift']) {
    const row = all.find(item => item.kind === 'element' && item.id === id);
    const doc = buildLibraryPreview(row, all.slice(), 'vi').document;
    const visuals = await page.evaluate(async doc => {
      const { openFabricStudio } = await import('/js/features/canvas-editor/fabric-studio.js');
      globalThis.tool = await openFabricStudio({
        snapshot: doc,
        sceneId: doc.entrySceneId,
        assetUrl: () => null,
        onApply: () => {},
        signal: new AbortController().signal,
      });
      return globalThis.canvas.getObjects().map(shape => ({
        type: shape.type,
        parts: shape.getObjects?.().length || 0,
        missing: !!shape.momeviaMissingImage,
      }));
    }, doc);
    assert(visuals.every(shape => !shape.missing &&
      (shape.type === 'image' || (shape.type === 'group' && shape.parts > 1))),
    id + ' must retain its visible silhouette in Studio');
    await page.evaluate(() => globalThis.tool.close());
  }

  console.log("PASS real Fabric download: 10 caption fields, A/B positive control, long captions and overflow/resize guard, 4 masks, 6 vector assemblies and 3 image assemblies; 2x bounds.");
} finally {
  await browser.close();
}
