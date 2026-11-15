import {
  correctSpdxExpression,
  spdxExpressionSatisfies,
} from "../licenses/spdx.js";
import type { LicenseCheckOptions, LicenseValue } from "../types.js";

const LICENSE_TITLE_UNKNOWN = "UNKNOWN";
const bsdLicenses = ["0BSD", "BSD-2-Clause", "BSD-3-Clause", "BSD-4-Clause"];

const transformBSD = (spdx: string): string =>
  spdx === "BSD" ? `(${bsdLicenses.join(" OR ")})` : spdx;
const expandBSD = (spdx: string): string[] =>
  spdx === "BSD" ? bsdLicenses : [spdx];
const invertResultOf =
  (fn: (spdx: string) => boolean) =>
  (spdx: string): boolean =>
    !fn(spdx);
const spdxIsValid = (spdx: string): boolean =>
  correctSpdxExpression(spdx) === spdx;

const parsePolicyList = (value: string): string[] => {
  const licenses: string[] = [];

  value.split(";").forEach((license: string) => {
    const trimmed = license.trim();
    if (trimmed.length > 0) {
      licenses.push(trimmed);
    }
  });

  return licenses;
};

export function getLicensePolicy(
  options: Pick<LicenseCheckOptions, "failOn" | "onlyAllow">,
): { failOnLicenses: string[]; onlyAllowLicenses: string[] } {
  if (options.failOn) {
    return {
      failOnLicenses: parsePolicyList(options.failOn),
      onlyAllowLicenses: [],
    };
  }

  if (options.onlyAllow) {
    return {
      failOnLicenses: [],
      onlyAllowLicenses: parsePolicyList(options.onlyAllow),
    };
  }

  return {
    failOnLicenses: [],
    onlyAllowLicenses: [],
  };
}

export function checkForFailOn(
  currentLicense: LicenseValue | LicenseValue[],
  failOnLicenses: string[],
): void {
  if (!Array.isArray(failOnLicenses) || failOnLicenses.length === 0) {
    return;
  }

  const licenses = Array.isArray(currentLicense)
    ? currentLicense
    : [currentLicense];
  if (
    licenses.some(
      (license) =>
        typeof license === "string" && failOnLicenses.includes(license),
    )
  ) {
    throw new Error(
      `Found license defined by the --failOn flag: "${currentLicense}". Exiting.`,
    );
  }
}

/**
 * Check if the current license contains (eventually among others) at least one of the allowed licenses.
 */
export function checkForOnlyAllow(
  currentLicense: LicenseValue | LicenseValue[],
  packageName: string,
  onlyAllowLicenses: string[],
): void {
  if (onlyAllowLicenses.length > 0) {
    let containsOneOfAllowedPackages = false;

    for (const allowedLicense of onlyAllowLicenses) {
      // "currentLicense" is a longer string that may contain several license names,
      // and we check if one of those is a license listed in the "onlyAllowLicenses"
      // licenses array:
      if (
        (typeof currentLicense === "string" &&
          currentLicense.includes(allowedLicense)) ||
        (Array.isArray(currentLicense) &&
          currentLicense.includes(allowedLicense)) ||
        (typeof currentLicense === "object" &&
          currentLicense !== null &&
          !Array.isArray(currentLicense) &&
          (currentLicense.type === allowedLicense ||
            currentLicense.name === allowedLicense))
      ) {
        containsOneOfAllowedPackages = true;
        break;
      }
    }

    if (!containsOneOfAllowedPackages) {
      throw new Error(
        `Package "${packageName}" is licensed under "${currentLicense}" which is not permitted by the --onlyAllow flag. Exiting.`,
      );
    }
  }
}

export function throwIfLicensePolicyFails({
  currentLicense,
  failOnLicenses,
  onlyAllowLicenses,
  packageName,
}: {
  currentLicense?: LicenseValue | LicenseValue[];
  failOnLicenses: string[];
  onlyAllowLicenses: string[];
  packageName: string;
}): void {
  if (currentLicense) {
    checkForFailOn(currentLicense, failOnLicenses);
    checkForOnlyAllow(currentLicense, packageName, onlyAllowLicenses);
  }
}

export function getLicenseMatch(
  licensesArr: LicenseValue[],
  compareLicenses: string[],
): { hasUnknownLicense: boolean; match: boolean } {
  const expandedCompareLicenses = compareLicenses.flatMap(expandBSD);
  const validSPDXLicenses = expandedCompareLicenses.filter(spdxIsValid);
  const invalidSPDXLicenses = expandedCompareLicenses
    .map(transformBSD)
    .filter(invertResultOf(spdxIsValid));

  let hasUnknownLicense = false;
  let match = false;

  licensesArr.forEach((licenseValue) => {
    const license =
      typeof licenseValue === "string"
        ? licenseValue
        : (licenseValue.type ?? licenseValue.name ?? "");
    if (license.indexOf(LICENSE_TITLE_UNKNOWN) >= 0) {
      // Necessary due to colorization and preserves the historic include/exclude behavior for unknown licenses.
      hasUnknownLicense = true;
    } else {
      const withoutTrailingAsterisk = license.endsWith("*")
        ? license.slice(0, -1)
        : license;
      const transformed = transformBSD(withoutTrailingAsterisk);

      const correctedSpdx = correctSpdxExpression(transformed);
      if (
        invalidSPDXLicenses.indexOf(transformed) >= 0 ||
        (correctedSpdx &&
          validSPDXLicenses.length > 0 &&
          spdxExpressionSatisfies(correctedSpdx, validSPDXLicenses))
      ) {
        match = true;
      }
    }
  });

  return { hasUnknownLicense, match };
}
