import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { batchSchema, remeasuredSchema, type Batch, type Remeasured } from "./reading.js";

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const CORE = join(REPO_ROOT, "apps/mobile/modules/item-measure");
const BATCH_HOME = join(homedir(), "Martly/item-batches");

/** Returns the unzipped batch folder; bundles stay in ~/Martly/item-batches as calibration data */
export function openBatch(input: string) {
  const path = resolve(input);
  if (statSync(path).isDirectory()) return path;
  mkdirSync(BATCH_HOME, { recursive: true });
  execFileSync("ditto", ["-x", "-k", path, BATCH_HOME]);
  const top = execFileSync("unzip", ["-Z1", path], { encoding: "utf8" }).split("\n")[0]?.split("/")[0];
  const folder = top && existsSync(join(BATCH_HOME, top, "batch.json")) ? top : null;
  if (!folder) throw new Error("No <batchId>/batch.json found in the zip");
  return join(BATCH_HOME, folder);
}

export function loadBatch(folder: string): Batch {
  return batchSchema.parse(JSON.parse(readFileSync(join(folder, "batch.json"), "utf8")));
}

export function remeasure(folder: string): Remeasured[] {
  const dir = mkdtempSync(join(tmpdir(), "remeasure-"));
  const binary = join(dir, "remeasure");
  const sources = readdirSync(join(CORE, "ios/Core")).filter((f) => f.endsWith(".swift")).map((f) => join(CORE, "ios/Core", f));
  execFileSync("swiftc", ["-O", ...sources, join(CORE, "tools/remeasure.swift"), "-parse-as-library", "-o", binary], { stdio: "inherit" });
  const out = execFileSync(binary, [folder], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\n").filter(Boolean).map((line) => remeasuredSchema.parse(JSON.parse(line)));
}
