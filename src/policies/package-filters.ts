import type { ModuleInfos } from "../types.js";

export const getOptionArray = (
  option: string | string[] | undefined,
): string[] | false => {
  if (Array.isArray(option)) {
    return option;
  }

  if (typeof option === "string") {
    return option.split(";");
  }

  return false;
};

const matchesPackageSelector = (
  packageName: string,
  selector: string,
): boolean =>
  packageName.startsWith(
    selector.lastIndexOf("@") > 0 ? selector : `${selector}@`,
  );

export const includePackages = (
  whitelist: string[],
  packages: ModuleInfos,
): ModuleInfos => {
  const resultJson: ModuleInfos = {};

  Object.keys(packages).forEach((packageName) => {
    // Whitelist packages by declaring:
    // 1. the package full name. Ex: `react` (we suffix an '@' to ensure we don't match packages like `react-native`)
    // 2. the package full name and the major version. Ex: `react@16`
    // 3. the package full name and full version. Ex: `react@16.0.2`
    if (
      whitelist.findIndex((whitelistPackage) =>
        matchesPackageSelector(packageName, whitelistPackage),
      ) !== -1
    ) {
      resultJson[packageName] = packages[packageName];
    }
  });

  return resultJson;
};

export const excludePackages = (
  blacklist: string[],
  packages: ModuleInfos,
): ModuleInfos => {
  const resultJson: ModuleInfos = {};

  Object.keys(packages).forEach((packageName) => {
    // Blacklist packages by declaring:
    // 1. the package full name. Ex: `react` (we suffix an '@' to ensure we don't match packages like `react-native`)
    // 2. the package full name and the major version. Ex: `react@16`
    // 3. the package full name and full version. Ex: `react@16.0.2`
    if (
      blacklist.findIndex((blacklistPackage) =>
        matchesPackageSelector(packageName, blacklistPackage),
      ) === -1
    ) {
      resultJson[packageName] = packages[packageName];
    }
  });

  return resultJson;
};

export const excludePackagesStartingWith = (
  blacklist: string[],
  packages: ModuleInfos,
): ModuleInfos => {
  const resultJson = { ...packages };

  for (const packageName in resultJson) {
    for (const denyPrefix of blacklist) {
      if (packageName.startsWith(denyPrefix)) {
        delete resultJson[packageName];
      }
    }
  }

  return resultJson;
};

export const excludePrivatePackages = (packages: ModuleInfos): ModuleInfos => {
  const resultJson = { ...packages };

  Object.keys(resultJson).forEach((packageName) => {
    if (resultJson[packageName]?.private) {
      delete resultJson[packageName];
    }
  });

  return resultJson;
};
