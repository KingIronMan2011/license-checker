import fs from "node:fs";
import path from "node:path";

import { firstDefined } from "../shared/first-defined.js";
import type { Clarification, DependencyPackage } from "../types.js";

export function getRepositoryUrl({
  clarificationRepository,
  jsonRepository,
}: {
  clarificationRepository?: string;
  jsonRepository?: string | { url?: string };
}): string | undefined {
  if (clarificationRepository) {
    return clarificationRepository;
  }

  const repositoryUrl =
    typeof jsonRepository === "object" ? jsonRepository?.url : undefined;
  if (typeof repositoryUrl === "string") {
    return repositoryUrl
      .replace("git+ssh://git@", "git://")
      .replace("git+https://github.com", "https://github.com")
      .replace("git://github.com", "https://github.com")
      .replace("git@github.com:", "https://github.com/")
      .replace(/\.git$/, "");
  }
}

export function getAuthorDetails({
  clarification,
  author,
}: {
  clarification?: Clarification;
  author?: { name?: string; email?: string; url?: string };
}): { publisher?: string; email?: string; url?: string } {
  const publisher = firstDefined(clarification?.publisher, author?.name);
  const email = firstDefined(clarification?.email, author?.email);
  const url = firstDefined(clarification?.url, author?.url);

  return { publisher, email, url };
}

// Eventually store the contents of the module's README.md in currentExtendedPackageJson.readme:
export const storeReadmeInPackageJsonIfExists = (
  modulePath: string | undefined,
  currentExtendedPackageJson: DependencyPackage,
): void => {
  if (
    typeof modulePath !== "string" ||
    typeof currentExtendedPackageJson !== "object" ||
    modulePath === "" ||
    (typeof currentExtendedPackageJson?.readme === "string" &&
      currentExtendedPackageJson?.readme
        ?.toLowerCase()
        ?.indexOf("no readme data found") === -1)
  ) {
    return;
  }

  const readmeFile = path.join(modulePath, "README.md");

  if (fs.existsSync(readmeFile)) {
    currentExtendedPackageJson.readme = fs
      .readFileSync(readmeFile, "utf8")
      .toString();
  }
};
