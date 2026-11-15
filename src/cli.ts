#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getNormalizedArguments } from "./cli/options.js";
import { runLicenseCheck } from "./index.js";

async function main(): Promise<void> {
  const options = getNormalizedArguments(process.argv.slice(2));
  const items = await runLicenseCheck(options);
  if (options.silent) return;

  console.log(`Found ${items.length} dependencies:\n`);
  for (const item of items)
    console.log(`${item.name}@${item.version}  ${item.license}`);
  if (options.files) console.log(`\nLicense files copied to ${options.files}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
