import fs from "node:fs/promises";
import path from "node:path";

import type { DependencyPackage } from "../types.js";

interface ReadOptions {
  depth?: number | boolean;
  dev?: boolean;
  nopeer?: boolean;
  log?: (...args: unknown[]) => void;
}

const parsePackageJson = (content: string): DependencyPackage => {
  const packageJson: unknown = JSON.parse(content);
  return packageJson &&
    typeof packageJson === "object" &&
    !Array.isArray(packageJson)
    ? (packageJson as DependencyPackage)
    : {};
};

const readPackageJsonFromDisk = async (
  packagePath: string,
): Promise<DependencyPackage> => {
  try {
    const content = await fs.readFile(
      path.join(packagePath, "package.json"),
      "utf8",
    );
    return parsePackageJson(content);
  } catch {
    try {
      const source = await fs.readFile(
        path.join(packagePath, "index.js"),
        "utf8",
      );
      const manifest = /\/\*\*package(?:\s|$)([\s\S]*?)\*\*\//m.exec(
        source,
      )?.[1];
      if (!manifest) return {};
      const json = manifest.replace(/^\s*\*/gm, "");
      return parsePackageJson(json);
    } catch {
      return {};
    }
  }
};

const getDependencySpecs = (
  packageJson: DependencyPackage,
): Record<string, string | DependencyPackage> => ({
  ...packageJson.dependencies,
  ...packageJson.optionalDependencies,
});

const getRootDependencySpecs = (
  packageJson: DependencyPackage,
): Record<string, string | DependencyPackage> => ({
  ...getDependencySpecs(packageJson),
});

async function packageDirectories(directory: string): Promise<string[]> {
  let entries: Array<{ name: string }>;
  try {
    entries = await fs.readdir(directory, {
      withFileTypes: true,
      encoding: "utf8",
    });
  } catch {
    return [];
  }

  const packages: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      packages.push(
        ...(await packageDirectories(path.join(directory, entry.name))),
      );
      continue;
    }
    const packagePath = path.join(directory, entry.name);
    try {
      if ((await fs.stat(packagePath)).isDirectory())
        packages.push(packagePath);
    } catch {
      // Broken symlinks are not installed packages.
    }
  }
  return packages;
}

async function resolveInstalledPackage(
  fromPath: string,
  dependencyName: string,
): Promise<string | undefined> {
  let directory = fromPath;
  while (true) {
    const candidate = path.join(directory, "node_modules", dependencyName);
    try {
      if ((await fs.stat(candidate)).isDirectory()) return candidate;
    } catch {
      // Keep searching through parent node_modules directories.
    }
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

const findDependency = (
  packageJson: DependencyPackage,
  dependencyName: string,
): DependencyPackage | undefined => {
  let currentPackageJson: DependencyPackage | null = packageJson;

  while (currentPackageJson) {
    const dependency = currentPackageJson.dependencies?.[dependencyName];

    if (dependency && typeof dependency === "object") {
      return dependency;
    }

    if (currentPackageJson.realName === dependencyName) {
      return currentPackageJson;
    }

    currentPackageJson = currentPackageJson.link
      ? null
      : (currentPackageJson.parent ?? null);
  }
  return undefined;
};

const unmarkExtraneous = (
  packageJson: DependencyPackage,
  options: ReadOptions,
): void => {
  packageJson.extraneous = false;

  const dependencies: Record<string, string> =
    packageJson["_dependencies"] ?? {};

  if (
    options.dev &&
    packageJson.devDependencies &&
    (packageJson.root || packageJson.link)
  ) {
    Object.keys(packageJson.devDependencies).forEach((dependencyName) => {
      dependencies[dependencyName] = String(
        packageJson.devDependencies?.[dependencyName],
      );
    });
  }

  if (!options.nopeer && packageJson.peerDependencies) {
    Object.keys(packageJson.peerDependencies).forEach((dependencyName) => {
      dependencies[dependencyName] = String(
        packageJson.peerDependencies?.[dependencyName],
      );
    });
  }

  Object.keys(dependencies).forEach((dependencyName) => {
    const dependency = findDependency(packageJson, dependencyName);

    if (dependency?.extraneous) {
      unmarkExtraneous(dependency, options);
    }
  });
};

const readInstalledPackages = async (
  folder: string,
  options: ReadOptions = {},
): Promise<DependencyPackage> => {
  const rootPath = path.resolve(folder);
  const convertedNodes = new Map<string, DependencyPackage>();
  const packageJsonCache = new Map<string, Promise<DependencyPackage>>();

  const getCachedPackageJson = (packagePath: string) => {
    let packageJson = packageJsonCache.get(packagePath);
    if (!packageJson) {
      packageJson = readPackageJsonFromDisk(packagePath);
      packageJsonCache.set(packagePath, packageJson);
    }
    return packageJson;
  };

  const convertNode = async (
    installedPath: string,
    parent: DependencyPackage | null = null,
    depth = 0,
    dependencyName?: string,
  ): Promise<DependencyPackage> => {
    const existing = convertedNodes.get(installedPath);
    if (existing) return existing;

    const realPath = await fs
      .realpath(installedPath)
      .catch(() => installedPath);
    const packageJson = { ...(await getCachedPackageJson(realPath)) };
    const isRoot = installedPath === rootPath;
    const dependencySpecs = isRoot
      ? getRootDependencySpecs(packageJson)
      : getDependencySpecs(packageJson);
    const node: DependencyPackage = {
      ...packageJson,
      name: packageJson.name ?? dependencyName ?? path.basename(installedPath),
      version: packageJson.version,
      path: installedPath,
      realPath,
      realName:
        dependencyName ?? packageJson.name ?? path.basename(installedPath),
      _dependencies: Object.fromEntries(
        Object.entries(dependencySpecs).map(([key, value]) => [
          key,
          String(value),
        ]),
      ),
      dependencies: {},
      extraneous: true,
      depth,
    };
    if (realPath !== installedPath) node.link = realPath;
    if (node.realName && node.name !== node.realName) node.invalid = true;
    if (parent && !node.link) node.parent = parent;
    convertedNodes.set(installedPath, node);

    const convertedDependencies = (node.dependencies ??= {});
    for (const childPath of await packageDirectories(
      path.join(installedPath, "node_modules"),
    )) {
      const childName = path
        .relative(path.join(installedPath, "node_modules"), childPath)
        .split(path.sep)
        .join("/");
      convertedDependencies[childName] = await convertNode(
        childPath,
        node,
        depth + 1,
        childName,
      );
    }

    const specs = { ...dependencySpecs };
    if (options.dev && (isRoot || node.link)) {
      Object.assign(specs, packageJson.devDependencies);
    }
    if (!options.nopeer) Object.assign(specs, packageJson.peerDependencies);
    for (const [name, spec] of Object.entries(specs)) {
      if (
        options.nopeer &&
        packageJson.peerDependencies?.[name] !== undefined
      ) {
        continue;
      }
      const installed = await resolveInstalledPackage(installedPath, name);
      if (!installed) {
        if (packageJson.optionalDependencies?.[name] === undefined) {
          convertedDependencies[name] = String(spec);
        }
        continue;
      }
      convertedDependencies[name] = await convertNode(
        installed,
        node,
        depth + 1,
        name,
      );
    }
    return node;
  };

  const convertedRoot = await convertNode(rootPath);
  convertedRoot.root = true;
  unmarkExtraneous(convertedRoot, options);

  return convertedRoot;
};

export default readInstalledPackages;
