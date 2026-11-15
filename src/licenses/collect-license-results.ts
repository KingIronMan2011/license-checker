import { readdir } from "node:fs/promises";

import type { DependencyLicense } from "../types.js";

export async function collectLicenseResults(
  packages: DependencyLicense[],
): Promise<DependencyLicense[]> {
  for (const item of packages) {
    const entries = await readdir(item.packagePath, { withFileTypes: true });
    item.licenseFiles = entries
      .filter(
        (entry) =>
          entry.isFile() &&
          /^(license|licence|copying|notice)(\.|$)/i.test(entry.name),
      )
      .map((entry) => entry.name)
      .toSorted((a, b) => a.localeCompare(b));
  }

  return packages.toSorted(
    (a, b) =>
      a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
}
