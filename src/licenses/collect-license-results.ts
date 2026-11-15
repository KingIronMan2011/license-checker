import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { walkDependencyTree } from "../dependencies/walk-dependency-tree.js";
import { firstDefined } from "../shared/first-defined.js";
import { semverSatisfies } from "../shared/semver.js";
import type {
  Clarification,
  Clarifications,
  DependencyPackage,
  LicenseCheckOptions,
  LicenseCollectionOptions,
  LicenseValue,
  ModuleInfo,
  ModuleInfos,
} from "../types.js";
import { getCopyrightLines } from "./copyright.js";
import { detectLicenseTitle } from "./detect-license-title.js";
import { findLicenseFiles } from "./find-license-files.js";
import {
  getAuthorDetails,
  getRepositoryUrl,
  storeReadmeInPackageJsonIfExists,
} from "./package-metadata.js";

const LICENSE_TITLE_UNKNOWN = "UNKNOWN";
const INITIAL_MODULE_INFO: ModuleInfo = { licenses: LICENSE_TITLE_UNKNOWN };

const getPackageNameAndVersion = (packageJson: DependencyPackage): string =>
  `${packageJson.name}@${packageJson.version}`;

const findClarification = (
  clarifications: Clarifications,
  packageJson: DependencyPackage,
): Clarification | undefined => {
  const packageName = packageJson.name;
  const version = packageJson.version;
  if (!packageName || !version) return undefined;
  return clarifications[packageName]?.find(
    (clarification) =>
      version === clarification.semverRange ||
      semverSatisfies(version, clarification.semverRange),
  );
};

const shouldSkipPackage = ({
  packageJson,
  data,
  options,
}: {
  packageJson: DependencyPackage;
  data: ModuleInfos;
  options: LicenseCollectionOptions;
}): boolean =>
  Boolean(
    data[getPackageNameAndVersion(packageJson)] ||
    (options.production && packageJson.extraneous) ||
    (options.development && !packageJson.extraneous && !packageJson.root),
  );

const addPackageMetadata = ({
  moduleInfo,
  packageJson,
  clarification,
  options,
}: {
  moduleInfo: ModuleInfo;
  packageJson: DependencyPackage;
  clarification?: Clarification;
  options: LicenseCollectionOptions;
}): string | undefined => {
  const mustInclude = (propertyName: string) =>
    options.customFormat?.[propertyName] !== false;

  if (mustInclude("repository")) {
    const repositoryUrl = getRepositoryUrl({
      clarificationRepository: clarification?.repository,
      jsonRepository: packageJson.repository,
    });
    if (repositoryUrl) moduleInfo.repository = repositoryUrl;
  }

  if (mustInclude("url")) {
    // Older manifests may store the homepage in a nested `url.web` field.
    const url = firstDefined(
      clarification?.url,
      typeof packageJson.url === "object" ? packageJson.url.web : undefined,
    );
    if (url) moduleInfo.url = url;
  }

  if (typeof packageJson.author === "object") {
    const { publisher, email, url } = getAuthorDetails({
      clarification,
      author: packageJson.author,
    });
    if (mustInclude("publisher") && publisher) moduleInfo.publisher = publisher;
    if (mustInclude("email") && email) moduleInfo.email = email;
    if (typeof moduleInfo.url !== "undefined" && mustInclude("url") && url) {
      moduleInfo.url = url;
    }
  }

  if (options.unknown) moduleInfo.dependencyPath = packageJson.path;

  const modulePath = firstDefined(clarification?.path, packageJson.path);
  if (mustInclude("path") && typeof modulePath === "string") {
    moduleInfo.path = modulePath;
  }
  storeReadmeInPackageJsonIfExists(modulePath, packageJson);
  return modulePath;
};

const addLicenseMetadata = (
  moduleInfo: ModuleInfo,
  licenseData: LicenseValue | LicenseValue[] | undefined,
  readme: string | undefined,
): void => {
  if (licenseData) {
    if (Array.isArray(licenseData) && licenseData.length > 0) {
      moduleInfo.licenses = licenseData.flatMap((moduleLicense) => {
        const moduleLicenseTypeOrName =
          typeof moduleLicense === "string"
            ? moduleLicense
            : firstDefined(moduleLicense.type, moduleLicense.name);

        return typeof moduleLicenseTypeOrName === "string"
          ? [moduleLicenseTypeOrName]
          : [];
      });
    } else if (!Array.isArray(licenseData) && typeof licenseData === "object") {
      const licenseTitle = detectLicenseTitle(
        firstDefined(licenseData.type, licenseData.name),
      );
      if (licenseTitle) moduleInfo.licenses = licenseTitle;
    } else if (typeof licenseData === "string") {
      const licenseTitle = detectLicenseTitle(licenseData);
      if (licenseTitle) moduleInfo.licenses = licenseTitle;
    }
  } else {
    const licenseTitle = detectLicenseTitle(readme);
    if (licenseTitle) moduleInfo.licenses = licenseTitle;
  }

  if (Array.isArray(moduleInfo.licenses) && moduleInfo.licenses.length === 1) {
    moduleInfo.licenses = moduleInfo.licenses[0];
  }
};

const processLicenseFiles = ({
  modulePath,
  packagePath,
  packageNameAndVersion,
  moduleInfo,
  clarification,
  options,
}: {
  modulePath?: string;
  packagePath?: string;
  packageNameAndVersion: string;
  moduleInfo: ModuleInfo;
  clarification?: Clarification;
  options: LicenseCollectionOptions;
}): string | undefined => {
  let licenseFiles: string[] = [];
  let noticeFiles: string[] = [];
  let passedClarificationCheck = !clarification?.checksum;
  const mustInclude = (propertyName: string) =>
    options.customFormat?.[propertyName] !== false;

  if (clarification?.licenseFile) {
    licenseFiles = [clarification.licenseFile];
  }

  if (modulePath && fs.existsSync(modulePath)) {
    const files = fs.readdirSync(modulePath);
    if (!clarification?.licenseFile) licenseFiles = findLicenseFiles(files);
    noticeFiles = files.filter((filename) => {
      const uppercased = filename.toUpperCase();
      const name = path
        .basename(uppercased)
        .replace(path.extname(uppercased), "");
      return name === "NOTICE";
    });
  }

  for (const [index, filename] of licenseFiles.entries()) {
    if (!modulePath) continue;
    const licenseFile = path.join(modulePath, filename);
    if (!fs.lstatSync(licenseFile).isFile()) continue;
    let licenseContent: string | undefined;

    const licenseNeedsDetection =
      !moduleInfo.licenses ||
      (Array.isArray(moduleInfo.licenses)
        ? moduleInfo.licenses.some(
            (license) =>
              license === LICENSE_TITLE_UNKNOWN ||
              (typeof license === "string" && license.startsWith("Custom:")),
          )
        : typeof moduleInfo.licenses === "string" &&
          (moduleInfo.licenses.includes(LICENSE_TITLE_UNKNOWN) ||
            moduleInfo.licenses.startsWith("Custom:")));
    if (licenseNeedsDetection) {
      licenseContent = fs.readFileSync(licenseFile, "utf8");
      const licenseTitle = detectLicenseTitle(licenseContent);
      if (licenseTitle) moduleInfo.licenses = licenseTitle;
    }

    if (index !== 0) continue;

    if (clarification && !passedClarificationCheck) {
      licenseContent ??= fs.readFileSync(licenseFile, "utf8");
      const sha256 = createHash("sha256").update(licenseContent).digest("hex");
      if (clarification.checksum !== sha256) {
        throw new Error(
          `Clarification checksum mismatch for ${packageNameAndVersion} :(` +
            `\nFile checked: ${licenseFile}`,
        );
      }
      passedClarificationCheck = true;
    }

    if (mustInclude("licenseFile")) {
      moduleInfo.licenseFile = firstDefined(
        clarification?.licenseFile,
        options.basePath
          ? path.relative(options.basePath, licenseFile)
          : licenseFile,
      );
    }

    if (mustInclude("licenseText") && options.customFormat) {
      if (clarification?.licenseText) {
        moduleInfo.licenseText = clarification.licenseText;
      } else {
        licenseContent ??= fs.readFileSync(licenseFile, "utf8");
        moduleInfo.licenseText =
          options.args && !options.args.csv
            ? licenseContent.trim()
            : licenseContent
                .replace(/"/g, "'")
                .replace(/\r?\n|\r/g, " ")
                .trim();
      }

      if (clarification?.licenseStart) {
        const startIndex = moduleInfo.licenseText.indexOf(
          clarification.licenseStart,
        );
        const endIndex = clarification.licenseEnd
          ? moduleInfo.licenseText.indexOf(clarification.licenseEnd, startIndex)
          : moduleInfo.licenseText.length;
        moduleInfo.licenseText = moduleInfo.licenseText.substring(
          startIndex,
          endIndex,
        );
      }
    }

    if (mustInclude("copyright") && options.customFormat) {
      if (clarification?.copyright) {
        moduleInfo.copyright = clarification.copyright;
      } else {
        licenseContent ??= fs.readFileSync(licenseFile, "utf8");
        const copyrightLines = getCopyrightLines(licenseContent);
        if (copyrightLines.length > 0) {
          moduleInfo.copyright = copyrightLines[0]!.replace(/\n/g, ". ").trim();
        }
        if (copyrightLines.length > 1) {
          moduleInfo.copyright = `${moduleInfo.copyright}*`;
        }
      }
    }
  }

  if (!passedClarificationCheck) {
    throw new Error("All clarifications must come with a checksum");
  }

  let noticeFile: string | undefined;
  for (const filename of noticeFiles) {
    if (!packagePath) continue;
    const file = path.join(packagePath, filename);
    if (fs.lstatSync(file).isFile()) {
      noticeFile = options.basePath
        ? path.relative(options.basePath, file)
        : file;
    }
  }
  return noticeFile;
};

const collectPackageLicenseInfo = ({
  packageJson,
  data,
  options,
}: {
  packageJson: DependencyPackage;
  data: ModuleInfos;
  options: LicenseCollectionOptions;
}): boolean => {
  const moduleInfo = { ...INITIAL_MODULE_INFO };
  const packageNameAndVersion = getPackageNameAndVersion(packageJson);
  const clarification = findClarification(options.clarifications, packageJson);
  if (clarification) clarification.used = true;

  if (shouldSkipPackage({ packageJson, data, options })) return false;

  if (packageJson.private) moduleInfo.private = true;
  data[packageNameAndVersion] = moduleInfo;

  const modulePath = addPackageMetadata({
    moduleInfo,
    packageJson,
    clarification,
    options,
  });
  const licenseData =
    clarification?.licenses ?? packageJson.license ?? packageJson.licenses;
  addLicenseMetadata(moduleInfo, licenseData, packageJson.readme);

  const noticeFile = processLicenseFiles({
    modulePath,
    packagePath: packageJson.path,
    packageNameAndVersion,
    moduleInfo,
    clarification,
    options,
  });
  if (noticeFile) moduleInfo.noticeFile = noticeFile;

  if (!packageJson.name || !packageJson.version) {
    delete data[packageNameAndVersion];
  }

  if (options.customFormat) {
    const mustInclude = (propertyName: string) =>
      options.customFormat?.[propertyName] !== false;
    for (const customFormatKey of Object.keys(options.customFormat)) {
      if (
        !mustInclude(customFormatKey) ||
        moduleInfo[customFormatKey] !== undefined
      ) {
        continue;
      }
      const value = firstDefined(
        clarification?.[customFormatKey],
        typeof packageJson[customFormatKey] === "string"
          ? packageJson[customFormatKey]
          : options.customFormat[customFormatKey],
      );
      if (typeof value === "string" || typeof value === "boolean") {
        moduleInfo[customFormatKey] = value;
      }
    }
  }

  return true;
};
export const collectLicenseResults = ({
  args,
  basePath,
  clarifications = {},
  customFormat,
  development,
  direct,
  production,
  rootPackage,
  unknown,
}: {
  args?: LicenseCheckOptions;
  basePath?: string | null;
  clarifications?: Clarifications;
  customFormat?: LicenseCheckOptions["customFormat"];
  development?: boolean;
  direct?: number | boolean | string | null;
  production?: boolean;
  rootPackage: DependencyPackage;
  unknown?: boolean;
}): ModuleInfos => {
  const data: ModuleInfos = {};
  const options: LicenseCollectionOptions = {
    args: args ? { csv: args.csv } : undefined,
    basePath,
    clarifications,
    customFormat,
    development,
    production,
    unknown,
  };

  walkDependencyTree(rootPackage, {
    maxDepth: direct,
    shouldVisit: (dependency) => !data[getPackageNameAndVersion(dependency)],
    visit: (packageJson) =>
      collectPackageLicenseInfo({ packageJson, data, options }),
  });

  return data;
};
