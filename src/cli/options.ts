import path from "node:path";

import { supportsBasicColor } from "../output/ansi.js";
import type { NormalizedArguments, ParsedArguments } from "../types.js";

export const knownOptions = {
  angularCli: Boolean,
  clarificationsFile: path,
  clarificationsMatchAll: Boolean,
  color: Boolean,
  csv: Boolean,
  csvComponentPrefix: String,
  customPath: path,
  depth: Number, // Meant to replace the misleading "--direct" option
  development: Boolean,
  direct: [String, null],
  excludeLicenses: String,
  excludePackages: String,
  excludePackagesStartingWith: String,
  excludePrivatePackages: Boolean,
  failOn: String,
  files: path,
  help: Boolean,
  includeLicenses: String,
  includePackages: String,
  json: Boolean,
  limitAttributes: String,
  markdown: Boolean,
  nopeer: Boolean,
  onlyAllow: String,
  onlyunknown: Boolean,
  out: path,
  plainVertical: Boolean,
  production: Boolean,
  relativeLicensePath: Boolean,
  relativeModulePath: Boolean,
  silent: Boolean,
  start: String,
  summary: Boolean,
  unknown: Boolean,
  version: Boolean,
};
export const shortHands = {
  h: ["--help"],
  v: ["--version"],
};

function normalizeArgv(args: string[] = process.argv) {
  if (Array.isArray(args) && (args.length === 0 || args[0]?.startsWith("-"))) {
    return [process.execPath, "license-checker-rseidelsohn", ...args];
  }

  return args;
}

/**
 * Parses command-line arguments.
 *
 * @param args Command-line arguments to parse.
 */
function parseArguments(args: string[] = process.argv): ParsedArguments {
  const argv = normalizeArgv(args).slice(2);
  const parsedArguments: Record<string, unknown> = {};
  const optionNames = Object.keys(knownOptions);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith("-")) continue;
    if (/^-{2,}$/.test(argument)) break;

    const equalIndex = argument.indexOf("=");
    const hasEquals = equalIndex >= 0;
    let name = argument.replace(/^-+/, "");
    let valueFromEquals: string | undefined;
    if (hasEquals) {
      valueFromEquals = name.slice(name.indexOf("=") + 1);
      name = name.slice(0, name.indexOf("="));
    }

    if (name === "h" || name === "v") name = name === "h" ? "help" : "version";
    else if (name.length > 1 && !optionNames.includes(name)) {
      const matches = optionNames.filter((option) => option.startsWith(name));
      if (matches.length === 1) name = matches[0]!;
    }

    let negated = false;
    while (name.toLowerCase().startsWith("no-")) {
      negated = !negated;
      name = name.slice(3);
    }
    const kind = knownOptions[name as keyof typeof knownOptions];
    const isBoolean = kind === Boolean;
    let value: unknown;

    if (isBoolean || negated) {
      value = !negated;
      const next = argv[index + 1];
      if (!hasEquals && (next === "true" || next === "false")) {
        value = next === "true";
        index += 1;
      }
      if (hasEquals) {
        value = !(
          valueFromEquals === "false" ||
          valueFromEquals === "0" ||
          valueFromEquals === "null"
        );
      }
      if (negated && Array.isArray(kind) && kind.includes(null)) value = null;
    } else {
      const next = hasEquals ? valueFromEquals : argv[index + 1];
      if (next === undefined || next.startsWith("-")) {
        value = kind === String ? "" : true;
      } else {
        value = next;
        index += 1;
      }

      if (kind === Number && !Number.isNaN(Number(value)))
        value = Number(value);
      if (kind === path && value !== true) value = path.resolve(String(value));
      if (kind === path && value === true) continue;
    }

    if (
      kind === Number &&
      typeof value === "string" &&
      Number.isNaN(Number(value))
    )
      continue;
    parsedArguments[name] = value;
  }

  return parsedArguments as ParsedArguments;
}

/**
 * Converts a value for the "--direct" option into a number.
 *
 * The "--direct" option is meant to accept either a Boolean or a Number. Either of those values will then be taken for
 * determining the depth:
 * - Passing in no value or leaving the parameter off will be interpreted as Infinity
 * - Passing in true will be interpreted as Infinity
 * - Passing in false will be interpreted as 0
 * - Passing in a number will be interpreted as that number
 * - Passing in any other value that can't be recognized as a number will be interpreted as Infinity
 *
 * @param value Value passed to `--direct` or `--depth`.
 */
function toDepthNumber(
  value:
    | boolean
    | number
    | string
    | null
    | undefined = Number.POSITIVE_INFINITY,
): number {
  switch (typeof value) {
    case "string":
      return depthStringToNumber(value);
    case "boolean":
      return value ? Number.POSITIVE_INFINITY : 0;
    case "number":
      return Math.max(0, value);
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function depthStringToNumber(depthString: string): number {
  const lowered = depthString.toLowerCase();
  let numberValue: number;

  if (lowered === "true") {
    numberValue = Number.POSITIVE_INFINITY;
  } else if (lowered === "false") {
    numberValue = 0;
  } else {
    numberValue = Number.parseInt(lowered, 10);

    if (Number.isNaN(numberValue)) {
      numberValue = Number.POSITIVE_INFINITY;
    } else {
      numberValue = Math.max(0, numberValue);
    }
  }

  return numberValue;
}

/**
 * Applies default values to parsed command-line arguments.
 *
 * @param parsedArguments Parsed command-line arguments.
 */
export function setDefaultArguments(
  parsedArguments: ParsedArguments = {},
): NormalizedArguments {
  const argumentsWithDefaults = { ...parsedArguments };
  if (
    argumentsWithDefaults.color === null ||
    argumentsWithDefaults.color === undefined
  ) {
    argumentsWithDefaults.color = supportsBasicColor();
  }

  if (
    argumentsWithDefaults.json ||
    argumentsWithDefaults.markdown ||
    argumentsWithDefaults.csv
  ) {
    argumentsWithDefaults.color = false;
  }

  argumentsWithDefaults.start = argumentsWithDefaults.start ?? process.cwd();
  argumentsWithDefaults.relativeLicensePath = Boolean(
    argumentsWithDefaults.relativeLicensePath,
  );
  argumentsWithDefaults.relativeModulePath = Boolean(
    argumentsWithDefaults.relativeModulePath,
  );
  // "--depth" should replace "--direct", as it is better understandable:
  argumentsWithDefaults.direct = toDepthNumber(
    argumentsWithDefaults.depth ?? argumentsWithDefaults.direct,
  );

  return argumentsWithDefaults as NormalizedArguments;
}

export function getNormalizedArguments(
  args: string[] = process.argv,
): NormalizedArguments {
  return setDefaultArguments(parseArguments(args));
}
