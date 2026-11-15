import fs from "node:fs";

import { detectLicenseTitle } from "../licenses/detect-license-title.js";
import type { CustomFormat, ModuleInfos } from "../types.js";

function renderChildren(
  value: Record<string, unknown>,
  ancestorLastStates: boolean[],
): string[] {
  const keys = Object.keys(value);
  return keys.flatMap((key, index) => {
    const child = value[key];
    const isLast = index === keys.length - 1;
    const prefix = ancestorLastStates
      .map((wasLast) => (wasLast ? "   " : "│  "))
      .join("");
    const isContainer = child !== null && typeof child === "object";
    const line = `${prefix}${isLast ? "└" : "├"}─ ${key}${isContainer ? "" : `: ${String(child)}`}`;
    return [
      line,
      ...(isContainer
        ? renderChildren(child as Record<string, unknown>, [
            ...ancestorLastStates,
            isLast,
          ])
        : []),
    ];
  });
}

function asTreeObject(value: Record<string, unknown>): string {
  const lines = renderChildren(value, []);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export const asTree = (sorted: ModuleInfos): string => asTreeObject(sorted);

export const asSummary = (sorted: ModuleInfos): string => {
  const licenseCountMap = new global.Map<string, number>();
  const licenseCountArray: Array<{ license: string; count: number }> = [];
  const sortedLicenseCountObj: Record<string, string> = {};

  Object.values(sorted).forEach(({ licenses }) => {
    if (typeof licenses === "string") {
      licenseCountMap.set(licenses, (licenseCountMap.get(licenses) ?? 0) + 1);
    }
  });

  licenseCountMap.forEach((count, license) => {
    licenseCountArray.push({ license, count });
  });

  licenseCountArray
    .toSorted((a, b) => b.count - a.count)
    .forEach(({ license, count }) => {
      sortedLicenseCountObj[license] = String(count);
    });

  return asTreeObject(sortedLicenseCountObj);
};

/**
 * Exports data as Markdown (*.md) which has its own syntax.
 *
 * @param  sorted                  The sorted JSON data from all packages.
 * @param  {object} [customFormat] The custom format with information about the needed keys.
 * @return {string}                The returning plain text.
 */
export const asMarkDown = (
  sorted: ModuleInfos,
  customFormat?: CustomFormat,
): string => {
  const text: string[] = [];

  if (customFormat && Object.keys(customFormat).length > 0) {
    Object.keys(sorted).forEach((sortedItem) => {
      const moduleInfo = sorted[sortedItem];
      if (!moduleInfo) return;
      text.push(`- **[${sortedItem}](${moduleInfo.repository})**`);

      Object.keys(customFormat).forEach((customItem) => {
        text.push(`    - ${customItem}: ${moduleInfo[customItem]}`);
      });
    });
  } else {
    Object.keys(sorted).forEach((key) => {
      const module = sorted[key];
      if (!module) return;
      text.push(`- [${key}](${module.repository}) - ${module.licenses}`);
    });
  }

  return text.join("\n");
};

const getModuleNameForLicenseTextHeader = (moduleName = "") => {
  const lastIndexOfAtCharacter = moduleName.lastIndexOf("@");

  return `${moduleName.substring(0, lastIndexOfAtCharacter)} ${moduleName.substring(lastIndexOfAtCharacter + 1)}\n`;
};

/**
 * Output data in plain vertical format like Angular CLI does: https://angular.io/3rdpartylicenses.txt
 */
export const asPlainVertical = (sorted: ModuleInfos): string =>
  Object.entries(sorted)
    .map(([moduleName, moduleData]) => {
      let licenseText = getModuleNameForLicenseTextHeader(moduleName);

      if (
        Array.isArray(moduleData.licenses) &&
        moduleData.licenses.length > 0
      ) {
        licenseText += moduleData.licenses
          .flatMap((moduleLicense) =>
            typeof moduleLicense === "string"
              ? [moduleLicense]
              : [moduleLicense.type || moduleLicense.name].filter(
                  (license): license is string => Boolean(license),
                ),
          )
          .join(",");
      } else if (
        !Array.isArray(moduleData.licenses) &&
        moduleData.licenses !== undefined &&
        typeof moduleData.licenses === "object" &&
        (moduleData.licenses.type || moduleData.licenses.name)
      ) {
        licenseText += detectLicenseTitle(
          moduleData.licenses.type || moduleData.licenses.name,
        );
      } else if (typeof moduleData.licenses === "string") {
        licenseText += detectLicenseTitle(moduleData.licenses);
      }

      licenseText += "\n";

      if (typeof moduleData.licenseFile === "string") {
        licenseText += fs.readFileSync(moduleData.licenseFile, {
          encoding: "utf8",
        });
      }

      return licenseText;
    })
    .join("\n\n");
