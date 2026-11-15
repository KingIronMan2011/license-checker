import fs from "node:fs";
import path from "node:path";

import type { ModuleInfos } from "../types.js";

export async function writeOutputToFile(
  outputFile: string,
  formattedOutput: string,
): Promise<void> {
  const dir = path.dirname(outputFile);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(outputFile, formattedOutput, "utf-8");
}

export async function writeIndividualLicenseFilesToDir(
  outDir: string,
  resultJson: ModuleInfos,
): Promise<void> {
  await fs.promises.mkdir(outDir, { recursive: true });
  const manifestPath = path.join(outDir, ".license-checker-files.json");
  let previousFiles: string[] = [];
  try {
    const manifest: unknown = JSON.parse(
      await fs.promises.readFile(manifestPath, "utf-8"),
    );
    if (Array.isArray(manifest)) {
      previousFiles = manifest.filter(
        (file): file is string => typeof file === "string",
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const currentFiles: string[] = [];
  for (const key of Object.keys(resultJson)) {
    const moduleInfo = resultJson[key];
    if (!moduleInfo) continue;
    const { licenseFile } = moduleInfo;

    if (licenseFile && fs.existsSync(licenseFile)) {
      const outPath = path.join(outDir, `${key}-LICENSE.txt`);
      currentFiles.push(path.relative(outDir, outPath));
      // key contains versioned packages, potentially scoped, e.g. @foo/bar@1.2.3
      const effectiveOutDir = path.dirname(outPath);
      await fs.promises.mkdir(effectiveOutDir, { recursive: true });
      await fs.promises.copyFile(licenseFile, outPath);
    } else {
      console.warn(`No license file found for module '${key}'`);
    }
  }

  const currentFileSet = new Set(currentFiles);
  for (const previousFile of previousFiles) {
    const normalized = path.normalize(previousFile);
    const absolutePath = path.resolve(outDir, normalized);
    if (
      path.isAbsolute(previousFile) ||
      absolutePath === path.resolve(outDir) ||
      !absolutePath.startsWith(`${path.resolve(outDir)}${path.sep}`)
    ) {
      continue;
    }
    if (!currentFileSet.has(normalized)) {
      await fs.promises.rm(absolutePath, { force: true });
    }
  }
  await fs.promises.writeFile(
    manifestPath,
    JSON.stringify(currentFiles, null, 2),
    "utf-8",
  );
}
