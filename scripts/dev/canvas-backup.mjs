import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  canonicalStringify,
  validateDocument,
  publicDocument,
  assetIds,
} from "../../web/js/shared/canvas/index.js";

const FORMAT = "momevia-canvas-json-backup";
const COLLECTIONS = [
  "designs",
  "creates",
  "mutations",
  "assets",
  "contexts",
  "publications",
  "versions",
  "replies",
];
const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const managedFile = new RegExp(`^${UUID}\\.(?:png|jpg|webp)$`, "i");
const stagingFile = new RegExp(`^${UUID}\\.${UUID}\\.staging$`, "i");
const hash = (bytes) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const check = (ok, message) => {
  if (!ok) throw new Error(`Canvas backup: ${message}`);
};
const same = (a, b) => canonicalStringify(a) === canonicalStringify(b);
const count = (state) =>
  Object.fromEntries(
    COLLECTIONS.map((key) => [
      key,
      key === "replies"
        ? Object.values(state[key]).reduce(
            (total, list) => total + list.length,
            0,
          )
        : Object.keys(state[key]).length,
    ]),
  );

function plain(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function safeDirectory(directory) {
  check(
    typeof directory === "string" && directory.length > 0,
    "an explicit directory is required.",
  );
  const resolved = path.resolve(directory),
    parsed = path.parse(resolved);
  check(resolved !== parsed.root, "a filesystem root cannot be a canvas data directory.");
  let cursor = parsed.root;
  for (const part of resolved
    .slice(parsed.root.length)
    .split(path.sep)
    .filter(Boolean)) {
    cursor = path.join(cursor, part);
    const stat = fs.lstatSync(cursor);
    check(
      stat.isDirectory() && !stat.isSymbolicLink(),
      "directory links or non-directories are not allowed.",
    );
  }
  return resolved;
}
function entry(root, relative) {
  check(typeof relative === "string", "invalid backup member path.");
  check(
    relative === "canvas.json" ||
      (relative.startsWith("assets/") &&
        !relative.slice(7).includes("/") &&
        (managedFile.test(relative.slice(7)) ||
          stagingFile.test(relative.slice(7)))),
    "invalid backup member path.",
  );
  const target = path.resolve(root, ...relative.split("/"));
  check(
    target.startsWith(`${root}${path.sep}`),
    "member escapes its directory.",
  );
  return target;
}
function readStable(filename, keepBytes = false) {
  const before = fs.lstatSync(filename);
  check(
    before.isFile() && !before.isSymbolicLink(),
    "only regular files can be copied.",
  );
  const bytes = fs.readFileSync(filename),
    after = fs.lstatSync(filename);
  check(
    before.dev === after.dev &&
      before.ino === after.ino &&
      before.size === after.size &&
      before.mtimeMs === after.mtimeMs &&
      before.ctimeMs === after.ctimeMs &&
      bytes.length === after.size,
    "source changed while reading; stop writers and retry.",
  );
  return {
    ...(keepBytes ? { bytes } : {}),
    byteLength: bytes.length,
    signature: [
      after.dev,
      after.ino,
      after.size,
      after.mtimeMs,
      after.ctimeMs,
    ].join(":"),
    sha256: hash(bytes),
  };
}
function assertUnchanged(filename, original) {
  const latest = readStable(filename);
  check(
    latest.sha256 === original.sha256 &&
      latest.signature === original.signature,
    "source changed during backup; stop writers and retry.",
  );
}
function assetMembers(root) {
  const directory = path.join(root, "assets");
  if (!fs.existsSync(directory)) return [];
  safeDirectory(directory);
  return fs
    .readdirSync(directory)
    .sort()
    .map((name) => {
      check(
        managedFile.test(name) || stagingFile.test(name),
        "unknown file in assets; resolve it before backup.",
      );
      return `assets/${name}`;
    });
}
function validateAggregate(state, records) {
  check(
    plain(state) &&
      state.formatVersion === 1 &&
      Object.keys(state).length === COLLECTIONS.length + 1,
    "unsupported aggregate format or extra top-level data.",
  );
  for (const name of COLLECTIONS)
    check(plain(state[name]), `missing collection ${name}.`);
  const assets = state.assets;
  for (const [id, asset] of Object.entries(assets)) {
    check(
      asset.id === id &&
        managedFile.test(asset.storageKey || "") &&
        asset.storageKey.startsWith(`${id}.`),
      "invalid asset identity/storage key.",
    );
    const file = records.get(`assets/${asset.storageKey}`);
    check(file, `missing asset bytes for ${id}.`);
    check(
      asset.status === "ready" &&
        file.sha256 === asset.contentHash &&
        file.byteLength === asset.bytes,
      `asset checksum/status mismatch for ${id}.`,
    );
  }
  const refs = (doc, ownerId) => {
    for (const id of assetIds(doc))
      check(
        assets[id]?.ownerId === ownerId && assets[id].status === "ready",
        "missing or foreign document asset reference.",
      );
  };
  for (const [id, design] of Object.entries(state.designs)) {
    check(
      design.id === id &&
        typeof design.ownerId === "string" &&
        Number.isSafeInteger(design.revision) &&
        design.revision > 0,
      "invalid design identity/revision.",
    );
    validateDocument(design.document);
    check(
      hash(canonicalStringify(design.document)) === design.documentHash,
      "design document hash mismatch.",
    );
    refs(design.document, design.ownerId);
    check(
      design.source?.kind === "blank" ||
        (design.source?.kind === "template" &&
          typeof design.source.templateId === "string" &&
          typeof design.source.templateVersionId === "string"),
      "invalid design provenance.",
    );
  }
  for (const created of Object.values(state.creates))
    check(state.designs[created.result?.design?.id], "dangling create result.");
  for (const mutation of Object.values(state.mutations)) {
    const ack = mutation.result,
      d = state.designs[ack?.designId];
    check(
      d &&
        Number.isSafeInteger(ack.savedRevision) &&
        ack.savedRevision <= d.revision,
      "dangling mutation ACK.",
    );
  }
  for (const [id, version] of Object.entries(state.versions)) {
    check(
      id === version.id &&
        state.designs[version.designId] &&
        version.runtimeVersion === 1,
      "dangling/unsupported design version.",
    );
    validateDocument(version.document, { mode: "publish", requiredBindings: [] });
  }
  const gifts = new Map();
  for (const publication of Object.values(state.publications)) {
    const gift = publication.result?.gift,
      version = state.versions[gift?.designVersionId],
      design = state.designs[version?.designId];
    check(
      gift &&
        version &&
        design &&
        gift.userId === publication.ownerId &&
        design.ownerId === gift.userId &&
        gift.runtimeVersion === 1,
      "dangling publication owner/version.",
    );
    check(
      publication.result.publishedRevision === version.revision &&
        gift.sourceKind === design.source.kind &&
        (gift.templateId || null) === (design.source.templateId || null),
      "publication source/revision mismatch.",
    );
    validateDocument(gift.documentSnapshot, { mode: "publish", requiredBindings: [] });
    check(
      same(gift.documentSnapshot, version.document),
      "publication/version snapshot mismatch.",
    );
    const ids = assetIds(gift.documentSnapshot).sort();
    check(
      same(ids, [...(publication.assetIds || [])].sort()) &&
        same(ids, [...(gift.assetIds || [])].sort()),
      "publication pins do not match snapshot.",
    );
    refs(gift.documentSnapshot, gift.userId);
    check(!gifts.has(gift.id), "duplicate publication gift identity.");
    gifts.set(gift.id, gift);
    if (version.revision === design.revision)
      check(
        same(publicDocument(design.document), version.document),
        "current revision and immutable snapshot differ.",
      );
  }
  for (const context of Object.values(state.contexts))
    check(
      state.designs[context.designId]?.ownerId === context.ownerId,
      "dangling/foreign checkout context.",
    );
  for (const [giftId, replies] of Object.entries(state.replies)) {
    check(
      Array.isArray(replies) && gifts.has(giftId),
      "dangling reply collection.",
    );
    for (const reply of replies)
      check(reply.giftId === giftId, "reply gift reference mismatch.");
  }
  for (const [giftId, gift] of gifts)
    check(
      gift.replyCount === (state.replies[giftId] || []).length,
      "gift reply count mismatch.",
    );
  return count(state);
}
function newTarget(directory, source) {
  check(
    typeof directory === "string" && directory.length,
    "an explicit target directory is required.",
  );
  const target = path.resolve(directory),
    parent = safeDirectory(path.dirname(target));
  check(
    target !== source &&
      !target.startsWith(`${source}${path.sep}`) &&
      !source.startsWith(`${target}${path.sep}`),
    "source and target must be separate directories.",
  );
  check(
    path.dirname(target) === parent && !fs.existsSync(target),
    "target must not exist; overwriting or merging is forbidden.",
  );
  fs.mkdirSync(target, { mode: 0o700 });
  return target;
}
function writeFile(filename, bytes) {
  const fd = fs.openSync(filename, "wx", 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

export function exportCanvas({ source, target, offline = false } = {}) {
  check(
    offline === true,
    "--offline acknowledgement is required; stop all writers before export.",
  );
  const root = safeDirectory(source),
    originalMembers = ["canvas.json", ...assetMembers(root)],
    records = new Map();
  for (const relative of originalMembers)
    records.set(relative, readStable(entry(root, relative), relative === "canvas.json"));
  const state = JSON.parse(records.get("canvas.json").bytes.toString("utf8")),
    counts = validateAggregate(state, records);
  const destination = newTarget(target, root);
  fs.mkdirSync(path.join(destination, "assets"), { mode: 0o700 });
  for (const [relative, record] of records) {
    const current = readStable(entry(root, relative), true);
    check(current.sha256 === record.sha256 && current.signature === record.signature, "source changed during backup; stop writers and retry.");
    writeFile(entry(destination, relative), current.bytes);
  }
  check(
    same(originalMembers, ["canvas.json", ...assetMembers(root)]),
    "asset set changed during backup; stop writers and retry.",
  );
  for (const [relative, record] of records)
    assertUnchanged(entry(root, relative), record);
  const manifest = {
    format: FORMAT,
    formatVersion: 1,
    aggregateFormatVersion: 1,
    createdAt: new Date().toISOString(),
    offlineAcknowledged: true,
    counts,
    files: [...records].map(([file, record]) => ({
      file,
      bytes: record.byteLength,
      sha256: record.sha256,
    })),
  };
  // The manifest is the completion marker. A failed copy leaves a visibly incomplete new directory.
  writeFile(
    path.join(destination, "manifest.json"),
    Buffer.from(JSON.stringify(manifest, null, 2) + "\n"),
  );
  return manifest;
}

export function verifyCanvas({ source } = {}) {
  const root = safeDirectory(source),
    manifestRecord = readStable(path.join(root, "manifest.json"), true),
    manifest = JSON.parse(manifestRecord.bytes.toString("utf8"));
  check(
    manifest.format === FORMAT &&
      manifest.formatVersion === 1 &&
      manifest.aggregateFormatVersion === 1 &&
      manifest.offlineAcknowledged === true &&
      Array.isArray(manifest.files),
    "unsupported/incomplete backup manifest.",
  );
  const files = new Set(),
    records = new Map();
  for (const expected of manifest.files) {
    check(
      plain(expected) && !files.has(expected.file),
      "duplicate backup member.",
    );
    files.add(expected.file);
    const record = readStable(entry(root, expected.file), expected.file === "canvas.json");
    check(
      record.sha256 === expected.sha256 &&
        record.byteLength === expected.bytes,
      "backup file checksum mismatch.",
    );
    records.set(expected.file, record);
  }
  check(
    files.has("canvas.json") &&
      same([...files].sort(), ["canvas.json", ...assetMembers(root)].sort()),
    "backup file list mismatch.",
  );
  const counts = validateAggregate(
    JSON.parse(records.get("canvas.json").bytes.toString("utf8")),
    records,
  );
  check(same(counts, manifest.counts), "backup counts mismatch.");
  for (const [relative, record] of records)
    assertUnchanged(entry(root, relative), record);
  assertUnchanged(path.join(root, "manifest.json"), manifestRecord);
  return { manifest, records, root, manifestRecord };
}

export function restoreCanvas({ source, target } = {}) {
  const verified = verifyCanvas({ source }),
    destination = newTarget(target, verified.root);
  fs.mkdirSync(path.join(destination, "assets"), { mode: 0o700 });
  for (const [relative, record] of verified.records) {
    const current = readStable(entry(verified.root, relative), true);
    check(current.sha256 === record.sha256 && current.signature === record.signature, "backup changed during restore.");
    writeFile(entry(destination, relative), current.bytes);
  }
  for (const [relative, record] of verified.records) {
    assertUnchanged(entry(verified.root, relative), record);
    check(
      readStable(entry(destination, relative)).sha256 === record.sha256,
      "restored checksum mismatch.",
    );
  }
  assertUnchanged(
    path.join(verified.root, "manifest.json"),
    verified.manifestRecord,
  );
  writeFile(
    path.join(destination, "restore-manifest.json"),
    Buffer.from(
      JSON.stringify(
        {
          format: FORMAT,
          formatVersion: 1,
          restoredAt: new Date().toISOString(),
          counts: verified.manifest.counts,
          aggregateHash: verified.records.get("canvas.json").sha256,
        },
        null,
        2,
      ) + "\n",
    ),
  );
  return {
    restored: true,
    counts: verified.manifest.counts,
    files: verified.records.size,
  };
}

function run(args) {
  const [command, ...options] = args,
    parsed = {};
  check(
    ["export", "verify", "restore"].includes(command),
    "usage: canvas-backup.mjs export|verify|restore --source DIR [--target NEW_DIR] [--offline]",
  );
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (option === "--offline") {
      check(!Object.hasOwn(parsed, "offline"), "duplicate option.");
      parsed.offline = true;
    } else {
      check(
        ["--source", "--target"].includes(option) &&
          options[i + 1] &&
          !options[i + 1].startsWith("--"),
        "unknown option or missing directory.",
      );
      const key = option.slice(2);
      check(!Object.hasOwn(parsed, key), "duplicate option.");
      parsed[key] = options[++i];
    }
  }
  if (command === "verify") {
    check(!parsed.target && !parsed.offline, "verify accepts only --source.");
    const { manifest } = verifyCanvas(parsed);
    return {
      verified: true,
      counts: manifest.counts,
      files: manifest.files.length,
    };
  }
  if (command === "restore") {
    check(!parsed.offline, "restore accepts --source and --target.");
    return restoreCanvas(parsed);
  }
  const manifest = exportCanvas(parsed);
  return {
    exported: true,
    counts: manifest.counts,
    files: manifest.files.length,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(JSON.stringify(run(process.argv.slice(2)), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
