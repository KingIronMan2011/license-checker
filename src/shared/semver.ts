interface SemVer {
  major: string;
  minor: string;
  patch: string;
  prerelease: string[];
}

interface PartialVersion {
  major: string | null;
  minor: string | null;
  patch: string | null;
  prerelease: string[];
  specified: number;
  wildcard: boolean;
}

interface Comparator {
  operator: ">" | ">=" | "<" | "<=" | "=";
  version: SemVer;
}

const FULL_VERSION =
  /^=?v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const NUMERIC_IDENTIFIER = /^(0|[1-9]\d*)$/;

function parsePrerelease(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(".").map((identifier) => identifier);
}

function parseVersion(value: string): SemVer | null {
  const match = FULL_VERSION.exec(value);
  if (!match) return null;
  return {
    major: match[1],
    minor: match[2],
    patch: match[3],
    prerelease: parsePrerelease(match[4]),
  };
}

function compareNumeric(left: string, right: string): number {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  }

  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === rightPart) continue;
    const leftNumeric = NUMERIC_IDENTIFIER.test(leftPart);
    const rightNumeric = NUMERIC_IDENTIFIER.test(rightPart);
    if (leftNumeric && !rightNumeric) return -1;
    if (!leftNumeric && rightNumeric) return 1;
    if (leftNumeric && rightNumeric) return compareNumeric(leftPart, rightPart);
    return String(leftPart) < String(rightPart) ? -1 : 1;
  }
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1;
}

function compareVersions(left: SemVer, right: SemVer): number {
  for (const component of ["major", "minor", "patch"] as const) {
    const compared = compareNumeric(left[component], right[component]);
    if (compared !== 0) return compared;
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function parsePartialVersion(source: string): PartialVersion {
  const value = source.replace(/^=?v?/, "");
  const [withoutBuild] = value.split("+");
  const hyphenIndex = withoutBuild.indexOf("-");
  const core =
    hyphenIndex < 0 ? withoutBuild : withoutBuild.slice(0, hyphenIndex);
  const prereleaseText =
    hyphenIndex < 0 ? undefined : withoutBuild.slice(hyphenIndex + 1);
  const parts = core.split(".");
  if (parts.length > 3 || parts.some((part) => part.length === 0)) {
    throw new Error(`Invalid semantic version range token: ${source}`);
  }

  const values: Array<string | null> = [];
  let wildcardSeen = false;
  for (const part of parts) {
    if (/^(?:x|\*)$/i.test(part)) {
      wildcardSeen = true;
      values.push(null);
    } else if (/^(?:0|[1-9]\d*)$/.test(part) && !wildcardSeen) {
      values.push(part);
    } else {
      throw new Error(`Invalid semantic version range token: ${source}`);
    }
  }

  if (wildcardSeen && prereleaseText !== undefined) {
    throw new Error(`A wildcard range cannot include a prerelease: ${source}`);
  }

  if (
    prereleaseText !== undefined &&
    values.filter((part) => part !== null).length !== 3
  ) {
    throw new Error(`A prerelease requires a complete version: ${source}`);
  }

  const specified = values.filter((part) => part !== null).length;
  if (specified !== values.length) {
    for (
      let index = values.findIndex((part) => part === null);
      index < values.length;
      index += 1
    ) {
      if (values[index] !== null) {
        throw new Error(`Invalid numeric component after wildcard: ${source}`);
      }
    }
  }

  const prerelease =
    prereleaseText === undefined ? [] : parsePrerelease(prereleaseText);
  if (prereleaseText !== undefined && prerelease.length === 0) {
    throw new Error(`Invalid prerelease in semantic version range: ${source}`);
  }

  return {
    major: values["0"] ?? null,
    minor: values[1] ?? null,
    patch: values[2] ?? null,
    prerelease,
    specified,
    wildcard: specified < 3,
  };
}

function makeVersion(
  major: string,
  minor = "0",
  patch = "0",
  prerelease: string[] = [],
): SemVer {
  return { major, minor, patch, prerelease };
}

function increment(value: string): string {
  return (BigInt(value) + 1n).toString();
}

function lowerBound(partial: PartialVersion): SemVer | null {
  if (partial.major === null) return null;
  return makeVersion(
    partial.major,
    partial.minor ?? "0",
    partial.patch ?? "0",
    partial.prerelease,
  );
}

function upperBound(partial: PartialVersion): SemVer | null {
  if (partial.major === null) return null;
  if (partial.minor === null)
    return makeVersion(increment(partial.major), "0", "0", ["0"]);
  if (partial.patch === null) {
    return makeVersion(partial.major, increment(partial.minor), "0", ["0"]);
  }
  return makeVersion(partial.major, partial.minor, increment(partial.patch), [
    "0",
  ]);
}

function comparator(
  operator: Comparator["operator"],
  version: SemVer | null,
): Comparator[] {
  return version ? [{ operator, version }] : [];
}

function expandPartial(
  partial: PartialVersion,
  operator: string,
): Comparator[] {
  const lower = lowerBound(partial);
  const upper = upperBound(partial);

  if (operator === "^" || operator === "~" || operator === "~>") {
    if (!lower) return [];
    let ceiling: SemVer;
    if (operator === "~" || operator === "~>") {
      ceiling =
        partial.minor === null
          ? makeVersion(increment(partial.major as string), "0", "0", ["0"])
          : makeVersion(
              partial.major as string,
              increment(partial.minor),
              "0",
              ["0"],
            );
    } else if (partial.major !== "0") {
      ceiling = makeVersion(increment(partial.major as string), "0", "0", [
        "0",
      ]);
    } else if (partial.minor === null) {
      ceiling = makeVersion("1", "0", "0", ["0"]);
    } else if (partial.minor !== "0") {
      ceiling = makeVersion("0", increment(partial.minor), "0", ["0"]);
    } else if (partial.patch === null) {
      ceiling = makeVersion("0", "1", "0", ["0"]);
    } else {
      ceiling = makeVersion("0", "0", increment(partial.patch), ["0"]);
    }
    return [...comparator(">=", lower), ...comparator("<", ceiling)];
  }

  if (!lower) {
    if (
      operator === "" ||
      operator === "=" ||
      operator === ">=" ||
      operator === "<="
    )
      return [];
    throw new Error(`Invalid wildcard range operator: ${operator}`);
  }

  if (operator === "" || operator === "=") {
    if (!partial.wildcard) return comparator("=", lower);
    return [...comparator(">=", lower), ...comparator("<", upper)];
  }

  if (!partial.wildcard) {
    return comparator(operator as Comparator["operator"], lower);
  }

  switch (operator) {
    case ">=":
      return comparator(">=", lower);
    case ">":
      return comparator(">=", upper);
    case "<":
      return comparator("<", lower);
    case "<=":
      return comparator("<", upper);
    default:
      throw new Error(`Invalid semantic version range operator: ${operator}`);
  }
}

function tokenizeComparators(
  range: string,
): Array<{ operator: string; version: string }> {
  const result: Array<{ operator: string; version: string }> = [];
  let offset = 0;
  while (offset < range.length) {
    while (/\s/.test(range[offset] ?? "")) offset += 1;
    if (offset >= range.length) break;

    const operatorMatch = /^(~>|<=|>=|<|>|=|~|\^)/.exec(range.slice(offset));
    const operator = operatorMatch?.[0] ?? "";
    offset += operator.length;
    while (/\s/.test(range[offset] ?? "")) offset += 1;
    const start = offset;
    while (offset < range.length && !/\s/.test(range[offset] ?? ""))
      offset += 1;
    if (start === offset)
      throw new Error("Missing version after range operator");
    result.push({ operator, version: range.slice(start, offset) });
  }
  return result;
}

function expandHyphenRange(
  leftSource: string,
  rightSource: string,
): Comparator[] {
  const left = parsePartialVersion(leftSource);
  const right = parsePartialVersion(rightSource);
  return [
    ...comparator(">=", lowerBound(left)),
    ...(right.wildcard
      ? comparator("<", upperBound(right))
      : comparator("<=", lowerBound(right))),
  ];
}

function expandComparatorSet(source: string): Comparator[] {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(source.trim());
  if (hyphen) return expandHyphenRange(hyphen[1], hyphen[2]);

  return tokenizeComparators(source).flatMap(({ operator, version }) =>
    expandPartial(parsePartialVersion(version), operator),
  );
}

function comparatorMatches(version: SemVer, test: Comparator): boolean {
  const compared = compareVersions(version, test.version);
  switch (test.operator) {
    case "=":
      return compared === 0;
    case ">":
      return compared > 0;
    case ">=":
      return compared >= 0;
    case "<":
      return compared < 0;
    case "<=":
      return compared <= 0;
  }
}

function prereleaseAllowed(
  version: SemVer,
  comparators: Comparator[],
): boolean {
  if (version.prerelease.length === 0) return true;
  return comparators.some(
    ({ version: comparatorVersion }) =>
      comparatorVersion.prerelease.length > 0 &&
      comparatorVersion.major === version.major &&
      comparatorVersion.minor === version.minor &&
      comparatorVersion.patch === version.patch,
  );
}

export function semverSatisfies(versionString: string, range: string): boolean {
  const version = parseVersion(versionString);
  if (!version) return false;

  const alternatives = range.split("||");
  if (alternatives.some((alternative) => alternative.trim() === "")) {
    if (alternatives.length === 1) return true;
    throw new Error(`Invalid semantic version range: ${range}`);
  }

  return alternatives.some((alternative) => {
    const comparators = expandComparatorSet(alternative);
    return (
      prereleaseAllowed(version, comparators) &&
      comparators.every((test) => comparatorMatches(version, test))
    );
  });
}
