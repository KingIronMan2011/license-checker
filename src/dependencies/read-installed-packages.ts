import Arborist from "@npmcli/arborist";
import type { ArboristEdge, ArboristNode } from "@npmcli/arborist";
import PackageJson from "@npmcli/package-json";

import type { DependencyPackage } from "../types.js";

interface ReadOptions {
  depth?: number | boolean;
  dev?: boolean;
  nopeer?: boolean;
  log?: (...args: unknown[]) => void;
}

const clonePackageJson = (packageJson: unknown): DependencyPackage =>
  JSON.parse(JSON.stringify(packageJson ?? {})) as DependencyPackage;

const readPackageJsonFromDisk = async (
  packagePath: string,
): Promise<DependencyPackage> => {
  try {
    const packageJson = await PackageJson.prepare(packagePath);
    return clonePackageJson(packageJson.content);
  } catch {
    return {};
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

const isOptionalEdge = (edge: ArboristEdge): boolean =>
  edge.type === "optional" || edge.type === "peerOptional";

const isPeerEdge = (edge: ArboristEdge): boolean =>
  edge.type === "peer" || edge.type === "peerOptional";

const getNodeForPackageJson = (node: ArboristNode): ArboristNode =>
  node.target ?? node;

const getNodeForDependencies = (node: ArboristNode): ArboristNode =>
  node.target ?? node;

const getRealPath = (node: ArboristNode): string =>
  node.target?.realpath ?? node.realpath ?? node.path;

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
  const arb = new Arborist({ path: folder });
  const root = await arb.loadActual();
  const convertedNodes = new WeakMap<ArboristNode, DependencyPackage>();

  const convertNode = async (
    node: ArboristNode,
    parent: DependencyPackage | null = null,
    depth = 0,
    realName: string | null = null,
  ): Promise<DependencyPackage> => {
    if (convertedNodes.has(node)) {
      const converted = convertedNodes.get(node);
      if (converted) return converted;
    }

    const packageNode = getNodeForPackageJson(node);
    const packageJson = {
      ...clonePackageJson(packageNode.package),
      ...(await readPackageJsonFromDisk(packageNode.path)),
    };
    const dependencySpecs =
      node.root === node
        ? getRootDependencySpecs(packageJson)
        : getDependencySpecs(packageJson);
    const compatibilityPackageJson: DependencyPackage = {
      ...packageJson,
      name: packageJson.name ?? node.name,
      version: packageJson.version ?? node.version,
      path: node.path,
      realPath: getRealPath(node),
      realName: realName ?? packageJson.name ?? node.name,
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

    if (
      compatibilityPackageJson.realName &&
      compatibilityPackageJson.name !== compatibilityPackageJson.realName
    ) {
      compatibilityPackageJson.invalid = true;
    }

    if (node.isLink) {
      compatibilityPackageJson.link = getRealPath(node);
    }

    convertedNodes.set(node, compatibilityPackageJson);

    if (parent && !compatibilityPackageJson.link) {
      compatibilityPackageJson.parent = parent;
    }

    const dependencyNode = getNodeForDependencies(node);
    const convertedDependencies = (compatibilityPackageJson.dependencies ??=
      {});

    for (const [childName, child] of dependencyNode.children) {
      if (options.nopeer && child.peer) {
        continue;
      }

      convertedDependencies[childName] = await convertNode(
        child,
        compatibilityPackageJson,
        depth + 1,
        childName,
      );
    }

    for (const [dependencyName, edge] of dependencyNode.edgesOut) {
      if (options.nopeer && isPeerEdge(edge)) {
        continue;
      }

      if (!edge.to) {
        if (!isOptionalEdge(edge)) {
          convertedDependencies[dependencyName] = edge.spec;
        }
        continue;
      }

      const dependency = await convertNode(
        edge.to,
        compatibilityPackageJson,
        depth + 1,
        dependencyName,
      );

      if (!edge.valid) {
        if (isPeerEdge(edge)) {
          dependency.peerInvalid = true;
        } else {
          dependency.invalid = true;
        }
      }

      convertedDependencies[dependencyName] = dependency;
    }

    return compatibilityPackageJson;
  };

  const convertedRoot = await convertNode(root);
  convertedRoot.root = true;
  unmarkExtraneous(convertedRoot, options);

  return convertedRoot;
};

export default readInstalledPackages;
