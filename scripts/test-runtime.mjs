import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = path.join(root, ".cache", "runtime-tests");
mkdirSync(output, { recursive: true });
const windowsGcc = "C:/Strawberry/c/bin/gcc.exe";
const compiler = process.env.CC || (process.platform === "win32" && existsSync(windowsGcc) ? windowsGcc : "gcc");
const suffix = process.platform === "win32" ? ".exe" : "";
const cases = [
  { name: "handles", args: ["-std=c11", "-Wno-int-to-pointer-cast", "-Wno-pointer-to-int-cast", "-Iruntime/tests/include", "runtime/tests/handles.c"] },
  { name: "resource-failures", args: ["-std=gnu11", "-ffunction-sections", "-fdata-sections", "-Wno-int-to-pointer-cast", "-Wno-pointer-to-int-cast", "-Iruntime/tests/resource-stubs", "-Iruntime/novantotto", "runtime/tests/resource_failures.c", "-Wl,--gc-sections"] }
];
for (const test of cases) {
  const executable = path.join(output, test.name + suffix);
  const compile = spawnSync(compiler, [...test.args, "-o", executable], { cwd: root, stdio: "inherit" });
  if (compile.error) throw compile.error;
  if (compile.status !== 0) process.exit(compile.status || 1);
  const run = spawnSync(executable, [], { cwd: root, stdio: "inherit" });
  if (run.error) throw run.error;
  if (run.status !== 0) process.exit(run.status || 1);
}

