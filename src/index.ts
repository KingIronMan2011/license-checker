import path from "node:path";

import { deleteNonDirectDependencies } from "./dependencies/direct-dependencies.js";
import readInstalledPackages from "./dependencies/read-installed-packages.js";
import { readJson } from "./files/read-json.js";
import {
  assertAllClarificationsWereUsed,
  readClarifications,
} from "./licenses/clarifications.js";
import { collectLicenseResults } from "./licenses/collect-license-results.js";
import { boldRed, supportsBasicColor } from "./output/ansi.js";
import { getFormattedOutput } from "./output/format-output.js";
import {
  writeIndividualLicenseFilesToDir,
  writeOutputToFile,
} from "./output/write-output.js";
import {
  getLicenseMatch,
  getLicensePolicy,
  throwIfLicensePolicyFails,
} from "./policies/license-policy.js";
import {
  excludePackages,
  excludePackagesStartingWith,
  excludePrivatePackages,
  getOptionArray,
  includePackages,
} from "./policies/package-filters.js";
import { createDebugLogger } from "./shared/debug.js";
import type { LicenseCheckOptions, ModuleInfos } from "./types.js";

const LICENSE_TITLE_UNKNOWN = "UNKNOWN";
const LICENSE_TITLE_UNLICENSED = "UNLICENSED";

const debugError = createDebugLogger("license-checker-rseidelsohn:error");
const debugLog = createDebugLogger(
  "license-checker-rseidelsohn:log",
  console.log.bind(console),
);

/**
 * Checks licenses based on the given options.
 *
 * @param options Controls the license checker's behavior.
 */
export const runLicenseCheck = async (
  options: LicenseCheckOptions,
): Promise<ModuleInfos> => {
  debugLog("scanning %s", options.start);

  // customPath is a path to a JSON file that defined a custom format
  if (options.customPath) {
    options.customFormat = readJson(options.customPath);
  }

  const optionsForReadingInstalledPackages = {
    depth: options.direct, // How deep to traverse the dependency tree
    nopeer: options.nopeer, // Whether to skip peerDependencies in output
    dev: true, // Whether to include devDependencies
    log: debugLog, // A function to log debug info
  };

  if (options.production || options.development) {
    optionsForReadingInstalledPackages.dev = false;
  }

  const { failOnLicenses, onlyAllowLicenses } = getLicensePolicy(options);

  // An object mapping from Package name -> list of what contents it should have, including a semver range for each entry
  const clarifications = readClarifications(options.clarificationsFile);

  let installedPackagesJson;
  try {
    installedPackagesJson = await readInstalledPackages(
      options.start,
      optionsForReadingInstalledPackages,
    );
  } catch (error) {
    debugError(error);
    throw error;
  }

  // Good to know:
  // The json object returned by readInstalledPackages stores all direct dependencies from
  // the package.json file in the property '_dependencies'. The property 'dependencies' contains all dependencies,
  // including the ones that are only required by other dependencies.
  if (optionsForReadingInstalledPackages.depth === 0) {
    deleteNonDirectDependencies(installedPackagesJson, options);
  }

  // 'results' might be longer than 'installedPackagesJson.dependencies', as it appends the version numbers to each key (package name),
  // e.g. 'grunt@1' instead of 'grunt', and this way contains all different installed versions of each package:
  const results = collectLicenseResults({
    args: options,
    basePath: options.relativeLicensePath ? installedPackagesJson.path : null,
    clarifications,
    customFormat: options.customFormat,
    development: options.development,
    direct: options.direct,
    production: options.production,
    rootPackage: installedPackagesJson,
    unknown: options.unknown,
  });

  if (options.clarificationsMatchAll) {
    assertAllClarificationsWereUsed(clarifications);
  }

  const colorize = options.color;
  const sorted: ModuleInfos = {}; // 'sorted' will store the same items as results, but sorted by package name and version
  let resultJson: ModuleInfos = {};
  const excludeLicenses = options.excludeLicenses
    ?.match(/([^\\\][^,]|\\,)+/g)
    ?.map((license) => license.replace(/\\,/g, ",").replace(/^\s+|\s+$/g, ""));
  const includeLicenses = options.includeLicenses
    ?.match(/([^\\\][^,]|\\,)+/g)
    ?.map((license) => license.replace(/\\,/g, ",").replace(/^\s+|\s+$/g, ""));

  const colorizeString = (string: string) =>
    colorize ? boldRed(string, supportsBasicColor()) : string;

  // This following block stores the licenses in the sorted object (before, the sorted object is the empty object):
  Object.keys(results)
    .toSorted()
    .forEach((item) => {
      const moduleInfo = results[item];
      if (!moduleInfo) return;

      if (moduleInfo.private) {
        moduleInfo.licenses = colorizeString(LICENSE_TITLE_UNLICENSED);
      }

      if (!moduleInfo.licenses) {
        moduleInfo.licenses = colorizeString(LICENSE_TITLE_UNKNOWN);
      }

      if (
        options.unknown &&
        moduleInfo.licenses &&
        moduleInfo.licenses !== LICENSE_TITLE_UNKNOWN &&
        String(moduleInfo.licenses).indexOf("*") > -1
      ) {
        moduleInfo.licenses = colorizeString(LICENSE_TITLE_UNKNOWN);
      }

      if (
        options.relativeModulePath &&
        moduleInfo.path !== null &&
        moduleInfo.path !== undefined
      ) {
        moduleInfo.path = path.relative(options.start, moduleInfo.path);
      }

      if (options.onlyunknown) {
        if (
          String(moduleInfo.licenses).indexOf("*") > -1 ||
          String(moduleInfo.licenses).indexOf(LICENSE_TITLE_UNKNOWN) > -1
        ) {
          sorted[item] = moduleInfo;
        }
      } else {
        sorted[item] = moduleInfo;
      }
    });

  let noPackagesFoundError;
  if (!Object.keys(sorted).length) {
    noPackagesFoundError = new Error("No packages found in this path...");
  }

  // This following block stores the entries from the 'sorted' object in the
  // resultJson object (before, the resultJson object is the empty object):
  if (
    (!Array.isArray(excludeLicenses) || excludeLicenses.length === 0) &&
    (!Array.isArray(includeLicenses) || includeLicenses.length === 0)
  ) {
    resultJson = { ...sorted };
  } else {
    if (Array.isArray(excludeLicenses) && excludeLicenses.length > 0) {
      Object.entries(sorted).forEach(([packageName, packageData]) => {
        const { licenses } = packageData;

        if (!licenses) {
          resultJson[packageName] = packageData;
        } else {
          const licensesArr = Array.isArray(licenses) ? licenses : [licenses];
          const licenseMatch = getLicenseMatch(licensesArr, excludeLicenses);

          if (licenseMatch.hasUnknownLicense || !licenseMatch.match) {
            resultJson[packageName] = packageData;
          }
        }
      });
    }

    if (Array.isArray(includeLicenses) && includeLicenses.length > 0) {
      Object.entries(sorted).forEach(([packageName, packageData]) => {
        const { licenses } = packageData;

        if (!licenses) {
          resultJson[packageName] = packageData;
        } else {
          const licensesArr = Array.isArray(licenses) ? licenses : [licenses];
          const licenseMatch = getLicenseMatch(licensesArr, includeLicenses);

          if (licenseMatch.hasUnknownLicense || licenseMatch.match) {
            resultJson[packageName] = packageData;
          }
        }
      });
    }
  }

  // package whitelist
  const whitelist = getOptionArray(options.includePackages);
  if (whitelist) {
    resultJson = includePackages(whitelist, resultJson);
  }

  // package blacklist
  const blacklist = getOptionArray(options.excludePackages);
  if (blacklist) {
    resultJson = excludePackages(blacklist, resultJson);
  }

  // exclude by package name starting with a string
  const excludeStartStringsArr = getOptionArray(
    options.excludePackagesStartingWith,
  );
  if (excludeStartStringsArr) {
    resultJson = excludePackagesStartingWith(
      excludeStartStringsArr,
      resultJson,
    );
  }

  if (options.excludePrivatePackages) {
    resultJson = excludePrivatePackages(resultJson);
  }

  Object.keys(resultJson).forEach((packageName) => {
    throwIfLicensePolicyFails({
      currentLicense: resultJson[packageName]?.licenses,
      failOnLicenses,
      onlyAllowLicenses,
      packageName,
    });
  });

  if (noPackagesFoundError) {
    debugError(noPackagesFoundError);
    throw noPackagesFoundError;
  }

  if (options.out) {
    await writeOutputToFile(
      options.out,
      getFormattedOutput(resultJson, options),
    );
  }

  if (options.files) {
    await writeIndividualLicenseFilesToDir(options.files, resultJson);
  }

  return resultJson;
};

/**
 * Runs the license check for the given args.
 *
 * @param args Specifies the path to the module to check dependencies of.
 * @param callback Called after the checker finished.
 * @deprecated Will be removed in a future version. Please switch to {@link runLicenseCheck} instead.
 */
export const init = (
  args: LicenseCheckOptions,
  callback: (error: Error | null, results: ModuleInfos) => void,
): void => {
  runLicenseCheck(args).then(
    (result) => callback(null, result),
    (error: unknown) =>
      callback(error instanceof Error ? error : new Error(String(error)), {}),
  );
};
