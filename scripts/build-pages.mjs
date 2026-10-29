/* Assemble the static Pages site from the game's runtime inventory. */
import { spawnSync } from "node:child_process";
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = await realpath(path.resolve(fileURLToPath(new URL("..", import.meta.url))));
const output = path.join(root, "dist");
const prepared = spawnSync(process.execPath, [path.join(root, "scripts/prepare-offline.mjs")], {
  cwd: root,
  stdio: "inherit",
});
if (prepared.error) throw prepared.error;
if (prepared.status !== 0) throw new Error("Preparing the offline inventory failed.");

// The only directory this script removes is this checkout's literal dist/.
if (path.dirname(output) !== root || path.basename(output) !== "dist") {
  throw new Error("Refusing to clean an unexpected Pages output directory.");
}
const previous = await lstat(output).catch(error => {
  if (error.code === "ENOENT") return null;
  throw error;
});
if (previous) {
  if (!previous.isDirectory() || previous.isSymbolicLink() || await realpath(output) !== output) {
    throw new Error("Pages output must be an ordinary dist/ directory inside this checkout.");
  }
  await rm(output, { recursive: true });
}
await mkdir(output);

const inventory = JSON.parse(await readFile(path.join(root, "app/cache-assets.json"), "utf8"));
if (!Array.isArray(inventory.assets) || !inventory.assets.length) throw new Error("Runtime inventory is empty.");
const assets = new Set([...inventory.assets, "app/cache-assets.json", "service-worker.js", "LICENSE", "NOTICE.md"]);
async function licenses(directory) {
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await licenses(relative);
    else if (entry.isFile()) assets.add(relative);
    else throw new Error(`Unsupported license entry: ${relative}`);
  }
}
await licenses("docs/licenses");

let bytes = 0;
for (const relative of [...assets].sort()) {
  if (typeof relative !== "string" || relative.includes("\\") || relative.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error(`Invalid runtime path: ${relative}`);
  }
  const source = path.resolve(root, relative);
  const destination = path.resolve(output, relative);
  if (!source.startsWith(root + path.sep) || !destination.startsWith(output + path.sep)) {
    throw new Error(`Runtime path escapes its directory: ${relative}`);
  }
  const canonicalSource = await realpath(source);
  const info = await lstat(source);
  if (!info.isFile() || info.isSymbolicLink() || !canonicalSource.startsWith(root + path.sep)) {
    throw new Error(`Runtime asset must be an ordinary workspace file: ${relative}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  bytes += info.size;
}

const repository = process.env.GITHUB_REPOSITORY || "emmeoerre/tabboz";
const revision = process.env.GITHUB_SHA || "main";
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[A-Za-z0-9_.-]+$/.test(revision)) {
  throw new Error("Invalid source repository or revision.");
}
const sourceNotice = `Tabboz Simulator - source code\n\nSource for this distribution:\nhttps://github.com/${repository}/tree/${revision}\n\nDownload the corresponding source:\nhttps://github.com/${repository}/archive/${revision}.tar.gz\n\nThe repository contains the original game sources in engine/, the modified\nNovantotto runtime sources in runtime/novantotto/, the mobile interface in\napp/, and compiler/build instructions in runtime/README.md.\n\nOriginal game and web port: https://github.com/andreax79/tabboz\nOriginal Novantotto runtime: https://github.com/andreax79/novantotto\n\nSee LICENSE and NOTICE.md for licenses, attribution and third-party notices.\n`;
await writeFile(path.join(output, "SOURCE.txt"), sourceNotice);
await writeFile(path.join(output, ".nojekyll"), "");
bytes += Buffer.byteLength(sourceNotice);
console.log(`Prepared ${assets.size + 2} Pages files (${(bytes / 1024 / 1024).toFixed(2)} MiB) in dist/.`);
