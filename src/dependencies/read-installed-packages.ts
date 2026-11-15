import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

import type {
  DependencyLicense,
  DependencyScope,
  PackageJson,
} from "../types.js";

async function resolveDependency(
  parentDir: string,
  name: string,
): Promise<string | undefined> {
  let currentDir = parentDir;
  while (true) {
    const candidate = path.join(
      currentDir,
      "node_modules",
      name,
      "package.json",
    );
    try {
      await readFile(candidate, "utf8");
      return path.dirname(candidate);
    } catch {
      const parent = path.dirname(currentDir);
      if (parent === currentDir) return undefined;
      currentDir = parent;
    }
  }
}

export async function readInstalledPackages(
  projectDir: string,
  scope: Exclude<DependencyScope, "both">,
): Promise<DependencyLicense[]> {
  const root = JSON.parse(
    await readFile(path.join(projectDir, "package.json"), "utf8"),
  ) as PackageJson;
  const roots =
    scope === "production"
      ? { ...root.dependencies, ...root.optionalDependencies }
      : (root.devDependencies ?? {});
  const found = new Map<string, DependencyLicense>();
  const visited = new Set<string>();

  async function visit(
    packagePath: string,
    dependencyName: string,
  ): Promise<void> {
    let realPackagePath: string;
    try {
      realPackagePath = await realpath(packagePath);
    } catch {
      return;
    }
    if (visited.has(realPackagePath)) return;
    visited.add(realPackagePath);

    const pkg = JSON.parse(
      await readFile(path.join(packagePath, "package.json"), "utf8"),
    ) as PackageJson;
    const name = pkg.name ?? dependencyName;
    const version = pkg.version ?? "unknown";
    const key = `${name}@${version}`;
    found.set(key, {
      name,
      version,
      license:
        pkg.license && typeof pkg.license === "string"
          ? pkg.license
          : ((typeof pkg.license === "object" ? pkg.license.type : undefined) ??
            pkg.licenses?.map(({ type }) => type ?? "Unknown").join(" OR ") ??
            "Unknown"),
      scope,
      packagePath,
      licenseFiles: [],
    });

    const dependencies = { ...pkg.dependencies, ...pkg.optionalDependencies };
    for (const childName of Object.keys(dependencies).toSorted()) {
      const childPath = await resolveDependency(packagePath, childName);
      if (childPath) await visit(childPath, childName);
    }
  }

  for (const name of Object.keys(roots).toSorted()) {
    const packagePath = await resolveDependency(projectDir, name);
    if (packagePath) await visit(packagePath, name);
  }

  return [...found.values()];
}
