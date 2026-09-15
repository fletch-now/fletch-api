import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "fletch-sdk-package-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const manifest = JSON.parse(await readFile(new URL("../packages/fletch-sdk/package.json", import.meta.url), "utf8"));

try {
  const output = execFileSync(npm, ["pack", "--workspace", "fletch-sdk", "--json", "--pack-destination", temporary], {
    cwd: repository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const [packed] = JSON.parse(output);
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  const files = packed.files.map(function path(file) { return file.path; });
  for (const required of ["LICENSE", "README.md", "package.json", "dist/index.js", "dist/index.d.ts", "dist/generated/openapi.d.ts"]) {
    assert.ok(files.includes(required), `Missing ${required}`);
  }
  for (const file of files) {
    assert.ok(file.startsWith("dist/") || ["LICENSE", "README.md", "package.json"].includes(file), `Unexpected package file: ${file}`);
  }

  await writeFile(join(temporary, "package.json"), JSON.stringify({ private: true, type: "module" }));
  execFileSync(npm, ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", join(temporary, packed.filename)], {
    cwd: temporary,
    stdio: "inherit",
  });
  const installedLicense = await readFile(join(temporary, "node_modules/fletch-sdk/LICENSE"), "utf8");
  assert.equal(installedLicense, await readFile(new URL("../LICENSE", import.meta.url), "utf8"));

  await writeFile(join(temporary, "consumer.ts"), `
import assert from "node:assert/strict";
import { FletchClient, FletchError, type ContractSearchResponse } from "fletch-sdk";

const client = new FletchClient();
const url = new URL(client.url("/chains/{chainId}/search", {
  path: { chainId: 4663 }, query: { q: "$TSLA", page: 2, limit: 10 },
}));
assert.equal(url.pathname, "/api/v1/chains/4663/search");
assert.equal(url.searchParams.get("q"), "$TSLA");
assert.equal(url.searchParams.get("page"), "2");
assert.equal(typeof FletchError, "function");
export type Search = ContractSearchResponse;
`);
  const compiler = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url));
  const nodeTypes = fileURLToPath(new URL("../node_modules/@types", import.meta.url));
  execFileSync(process.execPath, [compiler, "consumer.ts", "--noEmit", "--strict", "--module", "NodeNext", "--target", "ES2022", "--typeRoots", nodeTypes], {
    cwd: temporary,
    stdio: "inherit",
  });
  execFileSync(process.execPath, ["consumer.ts"], { cwd: temporary, stdio: "inherit" });
  console.log(`Installed ${packed.name}@${packed.version}; runtime imports, declarations and license passed.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
