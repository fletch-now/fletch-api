// Refetches the two public documents this repository snapshots and records
// when they were fetched. The files are written byte for byte as served;
// nothing here edits them. When every served document matches spec/ the script
// writes nothing at all, SNAPSHOT.md included, so the weekly workflow finds a
// clean tree instead of a pull request whose only diff is a timestamp. Run
// `npm run generate` afterwards so the SDK's types follow the spec.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://fletch.now";
const SOURCES = [
  { path: "/api/v1/openapi.json", file: "openapi.json" },
  { path: "/llms.txt", file: "llms.txt" },
];

const specDir = join(dirname(fileURLToPath(import.meta.url)), "..", "spec");

async function fetchSource(source) {
  const response = await fetch(`${ORIGIN}${source.path}`, {
    headers: { "user-agent": "fletch-api-snapshot/1 (+https://github.com/fletch-now/fletch-api)" },
  });
  if (!response.ok) {
    throw new Error(`${source.path}: HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { ...source, bytes, servedAt: response.headers.get("date"), etag: response.headers.get("etag") };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

// The hash of the copy already in spec/, or null on the first run.
async function storedHash(file) {
  try {
    return sha256(await readFile(join(specDir, file)));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function snapshotNote(fetched, fetchedAt) {
  const rows = fetched.map(function row(source) {
    return `| \`spec/${source.file}\` | ${ORIGIN}${source.path} | ${source.servedAt ?? "(no Date header)"} | ${source.bytes.length} | \`${sha256(source.bytes)}\` |`;
  });
  return `# Snapshot

Fetched ${fetchedAt} by \`scripts/snapshot.mjs\`. Each file is the response body exactly as
served; the hash is over those bytes. The live documents change when Fletch deploys, so
compare before assuming the copy here is current.

| File | Source | Server date | Bytes | SHA-256 |
|---|---|---|---|---|
${rows.join("\n")}

To refresh: \`npm run snapshot && npm run generate\`, then commit \`spec/\` and
\`packages/fletch-sdk/src/generated/\` together.
`;
}

async function main() {
  const fetched = [];
  for (const source of SOURCES) {
    fetched.push(await fetchSource(source));
  }
  const fetchedAt = new Date().toISOString();
  let changed = 0;
  for (const source of fetched) {
    const hash = sha256(source.bytes);
    const unchanged = hash === (await storedHash(source.file));
    console.log(`${source.file}: ${source.bytes.length} bytes, sha256 ${hash.slice(0, 12)}… ${unchanged ? "(unchanged)" : "(changed)"}`);
    if (!unchanged) {
      changed += 1;
    }
  }
  if (changed === 0) {
    console.log("spec/ already matches what is served; nothing written");
    return;
  }
  for (const source of fetched) {
    await writeFile(join(specDir, source.file), source.bytes);
  }
  await writeFile(join(specDir, "SNAPSHOT.md"), snapshotNote(fetched, fetchedAt));
}

await main();
