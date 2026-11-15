import path from "node:path";

import type { LicenseCheckOptions } from "../types.js";

export interface CliOptions extends LicenseCheckOptions {}

export function getNormalizedArguments(args: string[]): CliOptions {
  const options: CliOptions = {
    start: process.cwd(),
    silent: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--silent" || arg === "-s") options.silent = true;
    else if (arg === "--check") options.check = true;
    else if (arg === "--production" || arg === "--prod") {
      options.production = true;
      options.development = false;
    } else if (arg === "--development" || arg === "--dev") {
      options.production = false;
      options.development = true;
    } else if (arg === "--all") {
      options.production = false;
      options.development = false;
    } else if (arg === "--extract" || arg === "-o" || arg === "--files") {
      const value = args[index + 1];
      if (!value || value.startsWith("-"))
        throw new Error(`${arg} requires a directory`);
      options.files = path.resolve(value);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.start = path.resolve(arg);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`Usage: license-checker [project-directory] [options]

Options:
  --check               List dependencies with no license metadata or license file
  --silent, -s          Do not print the license report
  --extract, --files <dir> Copy license files into <dir>
  --production, --prod  Scan production dependencies only
  --development, --dev  Scan development dependencies only
  --all                 Scan both dependency scopes (default)
  --help, -h            Show this help`);
}
