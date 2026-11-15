import fs from "node:fs";
import path from "node:path";

import type { LicenseCheckOptions, ModuleInfos } from "../types.js";
import { dim, whiteOnRgb } from "./ansi.js";
import { asCSV } from "./csv.js";
import { filterAttributes } from "./filter-attributes.js";
import { asMarkDown, asPlainVertical, asSummary, asTree } from "./renderers.js";

export function shouldColorizeOutput(args: LicenseCheckOptions): boolean {
  return (
    Boolean(args.color) &&
    !args.out &&
    !args.files &&
    !(args.csv || args.json || args.markdown || args.plainVertical)
  );
}

export function colorizeOutput(json: ModuleInfos): void {
  Object.keys(json).forEach((key) => {
    const index = key.lastIndexOf("@");
    const colorizedKey =
      whiteOnRgb(key.slice(0, index), [47, 79, 79]) +
      dim("@") +
      whiteOnRgb(key.slice(index + 1), [0, 128, 0]);
    if (colorizedKey === key) {
      return;
    }

    const moduleInfo = json[key];
    if (!moduleInfo) return;
    json[colorizedKey] = moduleInfo;

    delete json[key];
  });
}

function filterJson(
  limitAttributes: string | undefined,
  json: ModuleInfos,
): ModuleInfos {
  let filteredJson = json;

  if (limitAttributes) {
    filteredJson = {};
    const attributes = limitAttributes
      .split(",")
      .map((attribute) => attribute.trim());

    Object.keys(json).forEach((dependency) => {
      const moduleInfo = json[dependency];
      if (moduleInfo) {
        filteredJson[dependency] = filterAttributes(attributes, moduleInfo);
      }
    });
  }

  return filteredJson;
}

export function getFormattedOutput(
  modulesWithVersions: ModuleInfos,
  args: LicenseCheckOptions,
): string {
  let filteredJson = filterJson(args.limitAttributes, modulesWithVersions);
  const jsonCopy = Object.fromEntries(
    Object.entries(filteredJson).map(([moduleName, moduleInfo]) => [
      moduleName,
      { ...moduleInfo },
    ]),
  ) as ModuleInfos;

  if (args.files) {
    const filesDirectory = args.files;
    Object.keys(jsonCopy).forEach((moduleName) => {
      const moduleInfo = jsonCopy[moduleName];
      if (!moduleInfo) return;
      const outPath = path.join(filesDirectory, `${moduleName}-LICENSE.txt`);
      const originalLicenseFile = moduleInfo.licenseFile;

      if (originalLicenseFile && fs.existsSync(originalLicenseFile)) {
        if (args.relativeLicensePath) {
          if (args.out) {
            moduleInfo.licenseFile = path.relative(
              path.dirname(args.out),
              outPath,
            );
          } else {
            moduleInfo.licenseFile = path.relative(process.cwd(), outPath);
          }
        } else {
          moduleInfo.licenseFile = outPath;
        }
      }
    });
  }

  if (args.json) {
    return `${JSON.stringify(jsonCopy, null, 4)}\n`;
  }

  if (args.csv) {
    return asCSV(jsonCopy, args.customFormat, args.csvComponentPrefix);
  }

  if (args.markdown) {
    return `${asMarkDown(jsonCopy, args.customFormat)}\n`;
  }

  if (args.summary) {
    return asSummary(jsonCopy);
  }

  if (args.plainVertical || args.angularCli) {
    return asPlainVertical(jsonCopy);
  }

  return asTree(jsonCopy);
}
