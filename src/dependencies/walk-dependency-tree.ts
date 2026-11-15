import type { DependencyPackage } from "../types.js";

/**
 * Walks a dependency tree depth-first and calls `visit` for every accepted node.
 *
 * A maxDepth of 0 still visits direct dependencies, matching the license checker's historic `direct: 0` behavior.
 *
 * @param {DependencyTreeNode} rootDependency
 * @param {{
 *   maxDepth?: number | boolean | string | null,
 *   shouldVisit?: (dependency: DependencyTreeNode, currentDepth: number) => boolean,
 *   visit: (dependency: DependencyTreeNode, currentDepth: number) => void | boolean
 * }} options
 * @returns {void}
 */
export function walkDependencyTree(
  rootDependency: DependencyPackage,
  {
    maxDepth = Number.POSITIVE_INFINITY,
    shouldVisit = () => true,
    visit,
  }: {
    maxDepth?: number | boolean | string | null;
    shouldVisit?: (
      dependency: DependencyPackage,
      currentDepth: number,
    ) => boolean;
    visit: (
      dependency: DependencyPackage,
      currentDepth: number,
    ) => void | boolean;
  },
): void {
  const depthLimit =
    typeof maxDepth === "boolean"
      ? maxDepth
        ? Number.POSITIVE_INFINITY
        : 0
      : typeof maxDepth === "string"
        ? Number(maxDepth)
        : (maxDepth ?? Number.POSITIVE_INFINITY);

  const walk = (
    dependency: DependencyPackage | string,
    currentDepth: number,
  ): void => {
    if (typeof dependency === "string") return;
    if (!dependency || !shouldVisit(dependency, currentDepth)) {
      return;
    }

    const visitResult = visit(dependency, currentDepth);

    const dependencies = dependency.dependencies;
    if (visitResult === false || currentDepth > depthLimit || !dependencies) {
      return;
    }

    Object.keys(dependencies).forEach((dependencyName) => {
      const child = dependencies[dependencyName];
      if (child !== undefined) walk(child, currentDepth + 1);
    });
  };

  walk(rootDependency, 0);
}
