import {
  SPDX_DEPRECATED_LICENSE_IDS,
  SPDX_EXCEPTION_IDS,
  SPDX_LICENSE_IDS,
  SPDX_VERSION_RANGES,
} from "./spdx-data.js";

export interface SpdxLicense {
  license: string;
  plus?: true;
  exception?: string;
}

export interface SpdxBinaryExpression {
  left: SpdxExpression;
  conjunction: "and" | "or";
  right: SpdxExpression;
}

export type SpdxExpression = SpdxLicense | SpdxBinaryExpression;

type Operator = "AND" | "OR" | "WITH" | "(" | ")" | ":" | "+";

type Token =
  | { type: "license" | "exception" | "licenseRef"; value: string }
  | { type: "operator"; value: Operator };

const licenseIds = new Set<string>([
  ...SPDX_LICENSE_IDS,
  ...SPDX_DEPRECATED_LICENSE_IDS,
]);
const exceptionIds = new Set<string>(SPDX_EXCEPTION_IDS);

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;

  while (offset < expression.length) {
    const rest = expression.slice(offset);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      offset += whitespace[0].length;
      continue;
    }

    const documentLicenseRef =
      /^(DocumentRef-([A-Za-z0-9.-]+):LicenseRef-([A-Za-z0-9.-]+))/.exec(rest);
    const licenseRef = /^LicenseRef-([A-Za-z0-9.-]+)/.exec(rest);
    if (documentLicenseRef) {
      tokens.push({ type: "licenseRef", value: documentLicenseRef[1] });
      offset += documentLicenseRef[1].length;
      continue;
    }
    if (licenseRef) {
      const value = `LicenseRef-${licenseRef[1]}`;
      tokens.push({ type: "licenseRef", value });
      offset += value.length;
      continue;
    }

    const operator = /^(AND|OR|WITH)\b/i.exec(rest);
    if (operator) {
      tokens.push({
        type: "operator",
        value: operator[1].toUpperCase() as "AND" | "OR" | "WITH",
      });
      offset += operator[0].length;
      continue;
    }

    const punctuation = /^[()+:]/.exec(rest);
    if (punctuation) {
      if (punctuation[0] === "+" && /\s/.test(expression[offset - 1] ?? "")) {
        throw new Error(
          "A plus marker cannot be separated from its license identifier",
        );
      }
      tokens.push({ type: "operator", value: punctuation[0] as Operator });
      offset += punctuation[0].length;
      continue;
    }

    const identifier = /^[A-Za-z0-9.-]+/.exec(rest);
    if (identifier) {
      const value = identifier[0];
      if (licenseIds.has(value)) {
        tokens.push({ type: "license", value });
      } else if (exceptionIds.has(value)) {
        tokens.push({ type: "exception", value });
      } else {
        throw new Error(`Unknown SPDX identifier: ${value}`);
      }
      offset += value.length;
      continue;
    }

    throw new Error(`Invalid SPDX expression at offset ${offset}`);
  }

  return tokens;
}

export function parseSpdxExpression(source: string): SpdxExpression {
  const tokens = tokenize(source);
  let index = 0;
  const peek = (): Token | undefined => tokens[index];
  const takeOperator = (value: Operator): boolean => {
    if (peek()?.type === "operator" && peek()?.value === value) {
      index += 1;
      return true;
    }
    return false;
  };

  const parseAtom = (): SpdxExpression => {
    if (takeOperator("(")) {
      const nested = parseOr();
      if (!takeOperator(")")) throw new Error("Expected closing parenthesis");
      return nested;
    }

    const token = peek();
    if (!token || (token.type !== "license" && token.type !== "licenseRef")) {
      throw new Error("Expected a license identifier");
    }
    index += 1;
    const node: SpdxLicense = { license: token.value };

    if (token.type === "license" && takeOperator("+")) node.plus = true;
    if (takeOperator("WITH")) {
      const exception = peek();
      if (!exception || exception.type !== "exception") {
        throw new Error("Expected an SPDX exception after WITH");
      }
      node.exception = exception.value;
      index += 1;
    }
    return node;
  };

  const parseAnd = (): SpdxExpression => {
    let expression = parseAtom();
    while (takeOperator("AND")) {
      expression = { left: expression, conjunction: "and", right: parseAtom() };
    }
    return expression;
  };

  const parseOr = (): SpdxExpression => {
    let expression = parseAnd();
    while (takeOperator("OR")) {
      expression = { left: expression, conjunction: "or", right: parseAnd() };
    }
    return expression;
  };

  if (tokens.length === 0) throw new Error("SPDX expression cannot be empty");
  const result = parseOr();
  if (index !== tokens.length)
    throw new Error("Unexpected token in SPDX expression");
  return result;
}

export function isValidSpdxExpression(source: string): boolean {
  try {
    parseSpdxExpression(source);
    return true;
  } catch {
    return false;
  }
}

const transpositions: ReadonlyArray<readonly [string, string]> = (
  [
    ["GNU LESSER GENERAL PUBLIC LICENSE", "LGPL-2.1"],
    ["GNU Lesser General Public License", "LGPL-2.1"],
    ["GNU LESSER GENERAL PUBLIC LICENSE", "LGPL"],
    ["GNU Lesser General Public License", "LGPL"],
    ["LESSER GENERAL PUBLIC LICENSE", "LGPL-2.1"],
    ["Lesser General Public License", "LGPL-2.1"],
    ["LESSER GENERAL PUBLIC LICENSE", "LGPL"],
    ["Lesser General Public License", "LGPL"],
    ["GNU General Public License", "GPL"],
    ["Gnu public license", "GPL"],
    ["GNU Public License", "GPL"],
    ["GNU GENERAL PUBLIC LICENSE", "GPL"],
    ["Mozilla Public License", "MPL"],
    ["Universal Permissive License", "UPL"],
    ["GNU/GPL", "GPL"],
    ["GNU GLP", "GPL"],
    ["GNU LGPL", "LGPL"],
    ["GNU", "GPL"],
    ["GUN", "GPL"],
    ["GLP", "GPL"],
    ["Gpl", "GPL"],
    ["APGL", "AGPL"],
    ["APL", "Apache"],
    ["ISD", "ISC"],
    ["IST", "ISC"],
    ["MTI", "MIT"],
    ["WTH", "WTF"],
    ["WTFGPL", "WTFPL"],
    [" or later", "+"],
    [" International", ""],
    ["Claude", "Clause"],
    ["+", ""],
    ["-License", ""],
  ] as const
).toSorted(([left], [right]) => right.length - left.length);

type Transform = (value: string) => string;
const transforms: Transform[] = [
  (value) => value.toUpperCase(),
  (value) => value.trim(),
  (value) => value.replace(/\./g, ""),
  (value) => value.replace(/\s+/g, ""),
  (value) => value.replace(/\s+/g, "-"),
  (value) => value.replace("v", "-"),
  (value) => value.replace(/,?\s*(\d)/, "-$1"),
  (value) => value.replace(/,?\s*(\d)/, "-$1.0"),
  (value) => value.replace(/,?\s*(?:V\.?|Version|version)\s*(\d)/i, "-$1"),
  (value) => value.replace(/,?\s*(?:V\.?|Version|version)\s*(\d)/i, "-$1.0"),
  (value) => value[0]?.toUpperCase() + value.slice(1),
  (value) => value.replace("/", "-"),
  (value) => value.replace(/\s*V\s*(\d)/, "-$1").replace(/(\d)$/, "$1.0"),
  (value) => `${value}${value.includes("3.0") ? "-or-later" : "-only"}`,
  (value) => `${value}only`,
  (value) => value.replace(/(\d)$/, "-$1.0"),
  (value) => value.replace(/(-| )?(\d)$/, "-$2-Clause"),
  (value) => value.replace(/(-| )clause(-| )(\d)/i, "-$3-Clause"),
  (value) =>
    value.replace(
      /\b(Modified|New|Revised)(-| )?BSD((-| )License)?/i,
      "BSD-3-Clause",
    ),
  (value) =>
    value.replace(/\bSimplified(-| )?BSD((-| )License)?/i, "BSD-2-Clause"),
  (value) =>
    value.replace(
      /\b(Free|Net)(-| )?BSD((-| )License)?/i,
      "BSD-2-Clause-$1BSD",
    ),
  (value) =>
    value.replace(/\bClear(-| )?BSD((-| )License)?/i, "BSD-3-Clause-Clear"),
  (value) =>
    value.replace(/\b(Old|Original)(-| )?BSD((-| )License)?/i, "BSD-4-Clause"),
  (value) => `CC-${value}`,
  (value) => `CC-${value}-4.0`,
  (value) =>
    `CC-${value
      .replace(/Attribution/g, "BY")
      .replace(/NonCommercial/g, "NC")
      .replace(/NoDerivatives/g, "ND")
      .replace(/ (\d)/, "-$1")
      .replace(/ ?International/, "")}`,
  (value) =>
    `CC-${value
      .replace(/Attribution/g, "BY")
      .replace(/NonCommercial/g, "NC")
      .replace(/NoDerivatives/g, "ND")
      .replace(/ (\d)/, "-$1")
      .replace(/ ?International/, "")}-4.0`,
];

const basicLastResorts: ReadonlyArray<readonly [string, string]> = [
  ["UNLI", "Unlicense"],
  ["WTF", "WTFPL"],
  ["2 CLAUSE", "BSD-2-Clause"],
  ["2-CLAUSE", "BSD-2-Clause"],
  ["3 CLAUSE", "BSD-3-Clause"],
  ["3-CLAUSE", "BSD-3-Clause"],
  ["AFFERO", "AGPL-3.0-or-later"],
  ["AGPL", "AGPL-3.0-or-later"],
  ["APACHE", "Apache-2.0"],
  ["ARTISTIC", "Artistic-2.0"],
  ["BEER", "Beerware"],
  ["BOOST", "BSL-1.0"],
  ["BSD", "BSD-2-Clause"],
  ["CDDL", "CDDL-1.1"],
  ["ECLIPSE", "EPL-1.0"],
  ["FUCK", "WTFPL"],
  ["GNU", "GPL-3.0-or-later"],
  ["LGPL", "LGPL-3.0-or-later"],
  ["GPLV1", "GPL-1.0-only"],
  ["GPL-1", "GPL-1.0-only"],
  ["GPLV2", "GPL-2.0-only"],
  ["GPL-2", "GPL-2.0-only"],
  ["GPL", "GPL-3.0-or-later"],
  ["MIT +NO-FALSE-ATTRIBS", "MITNFA"],
  ["MIT", "MIT"],
  ["MPL", "MPL-2.0"],
  ["X11", "X11"],
  ["ZLIB", "Zlib"],
];

const licensesByFamily = new Map<string, string[]>();
for (const licenseId of SPDX_LICENSE_IDS) {
  const match = /^(.*)-\d+\.\d+$/.exec(licenseId);
  if (!match) continue;
  const family = match[1];
  const versions = licensesByFamily.get(family) ?? [];
  versions.push(licenseId);
  licensesByFamily.set(family, versions);
}

const singleVersionAliases: ReadonlyArray<readonly [string, string]> =
  Array.from(licensesByFamily.entries())
    .filter(([family, versions]) => family !== "APL" && versions.length === 1)
    .map(([family, versions]) => [family, versions[0]] as const);

const lastResorts: ReadonlyArray<readonly [string, string]> = [
  ...basicLastResorts,
  ...singleVersionAliases,
].toSorted(([left], [right]) => right.length - left.length);

const validLastResort = (value: string): string | null => {
  const uppercase = value.toUpperCase();
  return (
    lastResorts.find(([substring]) => uppercase.includes(substring))?.[1] ??
    null
  );
};

const anyCorrection = (
  value: string,
  check: (candidate: string) => string | null,
): string | null => {
  for (const [transposed, corrected] of transpositions) {
    if (value.includes(transposed)) {
      const result = check(value.replace(transposed, corrected));
      if (result !== null) return result;
    }
  }
  return null;
};

function upgradeGplIdentifiers(value: string): string {
  const only = new Set([
    "GPL-1.0",
    "LGPL-1.0",
    "AGPL-1.0",
    "GPL-2.0",
    "LGPL-2.0",
    "AGPL-2.0",
    "LGPL-2.1",
  ]);
  const later = new Set(["GPL-3.0", "LGPL-3.0", "AGPL-3.0"]);
  const plus = new Set([
    "GPL-1.0+",
    "GPL-2.0+",
    "GPL-3.0+",
    "LGPL-2.0+",
    "LGPL-2.1+",
    "LGPL-3.0+",
    "AGPL-1.0+",
    "AGPL-3.0+",
  ]);
  if (only.has(value)) return `${value}-only`;
  if (later.has(value)) return `${value}-or-later`;
  if (plus.has(value)) return `${value.slice(0, -1)}-or-later`;
  return value;
}

export function correctSpdxExpression(
  source: string,
  options: { upgrade?: boolean } = {},
): string | null {
  if (typeof source !== "string" || source.trim() === "") {
    throw new Error("Invalid argument. Expected non-empty string.");
  }
  const upgrade = options.upgrade ?? true;
  const postprocess = (value: string): string =>
    upgrade ? upgradeGplIdentifiers(value) : value;
  const input = source.trim();
  if (isValidSpdxExpression(input)) return postprocess(input);

  const noPlus = input.replace(/\+$/, "").trim();
  if (noPlus !== input && isValidSpdxExpression(noPlus))
    return postprocess(noPlus);

  const validTransformation = (value: string): string | null => {
    for (const transform of transforms) {
      const transformed = transform(value).trim();
      if (transformed !== value && isValidSpdxExpression(transformed))
        return transformed;
    }
    return null;
  };
  const transformed = validTransformation(input);
  if (transformed !== null) return postprocess(transformed);
  const transposed = anyCorrection(input, (candidate) =>
    isValidSpdxExpression(candidate)
      ? candidate
      : validTransformation(candidate),
  );
  if (transposed !== null) return postprocess(transposed);
  const fallback = validLastResort(input);
  if (fallback !== null) return postprocess(fallback);
  const fallbackTransposed = anyCorrection(input, validLastResort);
  return fallbackTransposed === null ? null : postprocess(fallbackTransposed);
}

function normalizeGplTerm(term: SpdxLicense): SpdxLicense {
  const legacy = /^(GPL|LGPL|AGPL|GFDL)-(\d+\.\d+)(-only|-or-later)?$/.exec(
    term.license,
  );
  if (!legacy) return term;
  const [, family, version, suffix] = legacy;
  const result = { ...term, license: `${family}-${version}` };
  if (suffix === "-or-later") result.plus = true;
  else if (suffix === "-only") delete result.plus;
  return result;
}

type VersionRangeEntry = string | readonly string[];
const versionRanges =
  SPDX_VERSION_RANGES as unknown as readonly (readonly VersionRangeEntry[])[];

function isInVersionRange(first: string, second: string): boolean {
  return versionRanges.some((range) => {
    const indexOf = (license: string): number =>
      range.findIndex((entry) =>
        typeof entry === "string" ? entry === license : entry.includes(license),
      );
    const firstIndex = indexOf(first);
    return firstIndex >= 0 && indexOf(second) >= 0;
  });
}

function isAtLeastInRange(first: string, second: string): boolean {
  return versionRanges.some((range) => {
    const indexOf = (license: string): number =>
      range.findIndex((entry) =>
        typeof entry === "string" ? entry === license : entry.includes(license),
      );
    const firstIndex = indexOf(first);
    const secondIndex = indexOf(second);
    return firstIndex >= 0 && secondIndex >= 0 && firstIndex >= secondIndex;
  });
}

function compatibleLicense(
  expression: SpdxLicense,
  approved: SpdxLicense,
): boolean {
  if (expression.exception !== approved.exception) return false;
  if (!approved.plus && !expression.plus)
    return expression.license === approved.license;
  if (approved.plus && expression.plus) {
    return isInVersionRange(expression.license, approved.license);
  }
  if (approved.plus)
    return isAtLeastInRange(expression.license, approved.license);
  return isAtLeastInRange(approved.license, expression.license);
}

function expandToDnf(expression: SpdxExpression): SpdxLicense[][] {
  if (!isBinaryExpression(expression)) return [[normalizeGplTerm(expression)]];
  const left = expandToDnf(expression.left);
  const right = expandToDnf(expression.right);
  if (expression.conjunction === "or") return [...left, ...right];
  return left.flatMap((leftTerms) =>
    right.map((rightTerms) => [...leftTerms, ...rightTerms]),
  );
}

function isBinaryExpression(
  expression: SpdxExpression,
): expression is SpdxBinaryExpression {
  return "conjunction" in expression;
}

export function spdxExpressionSatisfies(
  source: string,
  allowedExpressions: string[],
): boolean {
  const expressionDnf = expandToDnf(parseSpdxExpression(source));
  const allowed = allowedExpressions.map((value) => {
    const parsed = parseSpdxExpression(value);
    if (isBinaryExpression(parsed)) {
      throw new Error("Approved licenses cannot be AND or OR expressions.");
    }
    return normalizeGplTerm(parsed);
  });
  return expressionDnf.some((terms) =>
    terms.every((term) =>
      allowed.some((candidate) => compatibleLicense(term, candidate)),
    ),
  );
}
