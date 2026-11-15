import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DependencyLicense } from "../types.js";

export async function writeIndividualLicenseFilesToDir(
  outputDir: string,
  items: DependencyLicense[],
): Promise<void> {
  for (const item of items) {
    const safeName = item.name.replaceAll("/", "+");
    const destination = path.join(
      outputDir,
      item.scope,
      `${safeName}@${item.version}`,
    );
    await mkdir(destination, { recursive: true });
    for (const file of item.licenseFiles) {
      await cp(path.join(item.packagePath, file), path.join(destination, file));
    }
    if (item.licenseFiles.length === 0) {
      await writeFile(
        path.join(destination, "LICENSE-INFO.txt"),
        `License metadata: ${item.license}\n`,
      );
    }
  }
}
