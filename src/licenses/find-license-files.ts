import path from "node:path";

const BASENAMES_PRECEDENCE = [
  /^LICENSE$/,
  /^LICENSE-\w+$/, // e.g. LICENSE-MIT
  /^LICENCE$/,
  /^LICENCE-\w+$/, // e.g. LICENCE-MIT
  /^MIT-LICENSE$/,
  /^COPYING$/,
  /^README$/, // Use README as a low-priority fallback license source.
];

// Find and list license files in the precedence order
export const findLicenseFiles = (dirFiles: string[]): string[] => {
  const files: string[] = [];

  for (const basenamePattern of BASENAMES_PRECEDENCE) {
    const matchingFile = dirFiles.find((filename) =>
      basenamePattern.test(getBaseFileName(filename)),
    );
    if (matchingFile) files.push(matchingFile);
  }

  return files;
};

const getBaseFileName = (filename: string): string =>
  path.basename(filename, path.extname(filename)).toUpperCase();
