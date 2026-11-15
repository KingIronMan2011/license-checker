import fs from "node:fs";
import path from "node:path";

import cloneDeep from "lodash.clonedeep";

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

    json[colorizedKey] = json[key];

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
      filteredJson[dependency] = filterAttributes(attributes, json[dependency]);
    });
  }

  return filteredJson;
}

export function getFormattedOutput(
  modulesWithVersions: ModuleInfos,
  args: LicenseCheckOptions,
): string {
  let filteredJson = filterJson(args.limitAttributes, modulesWithVersions);
  const jsonCopy = cloneDeep(filteredJson);

  if (args.files) {
    const filesDirectory = args.files;
    Object.keys(jsonCopy).forEach((moduleName) => {
      const outPath = path.join(filesDirectory, `${moduleName}-LICENSE.txt`);
      const originalLicenseFile = jsonCopy[moduleName].licenseFile;

      if (originalLicenseFile && fs.existsSync(originalLicenseFile)) {
        if (args.relativeLicensePath) {
          if (args.out) {
            jsonCopy[moduleName].licenseFile = path.relative(
              path.dirname(args.out),
              outPath,
            );
          } else {
            jsonCopy[moduleName].licenseFile = path.relative(
              process.cwd(),
              outPath,
            );
          }
        } else {
          jsonCopy[moduleName].licenseFile = outPath;
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
