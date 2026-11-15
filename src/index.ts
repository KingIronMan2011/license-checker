import path from "node:path";

import { readInstalledPackages } from "./dependencies/read-installed-packages.js";
import { collectLicenseResults } from "./licenses/collect-license-results.js";
import { writeIndividualLicenseFilesToDir } from "./output/write-output.js";
import type {
  DependencyLicense,
  DependencyScope,
  LicenseCheckOptions,
} from "./types.js";

export type {
  DependencyLicense,
  DependencyScope,
  LicenseCheckOptions,
} from "./types.js";

export async function runLicenseCheck(
  options: LicenseCheckOptions = {},
): Promise<DependencyLicense[]> {
  const projectDir = path.resolve(options.start ?? process.cwd());
  const scopes: Array<Exclude<DependencyScope, "both">> = options.production
    ? ["production"]
    : options.development
      ? ["development"]
      : ["production", "development"];
  const results = new Map<string, DependencyLicense>();

  for (const scope of scopes) {
    const packages = await collectLicenseResults(
      await readInstalledPackages(projectDir, scope),
    );
    for (const item of packages) {
      const key = `${item.name}@${item.version}`;
      const existing = results.get(key);
      if (existing) existing.scope = "both";
      else results.set(key, item);
    }
  }

  const items = [...results.values()].toSorted(
    (a, b) =>
      a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
  if (options.files)
    await writeIndividualLicenseFilesToDir(path.resolve(options.files), items);
  return items;
}
