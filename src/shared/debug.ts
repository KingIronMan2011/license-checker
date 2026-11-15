import { format } from "node:util";

function namespaceMatches(pattern: string, namespace: string): boolean {
  const expression = new RegExp(
    `^${pattern.split("*").map(escapeRegExp).join(".*?")}$`,
  );
  return expression.test(namespace);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function isEnabled(namespace: string): boolean {
  const patterns = (process.env.DEBUG ?? "").split(/[\s,]+/).filter(Boolean);
  let enabled = false;

  for (const pattern of patterns) {
    const excluded = pattern.startsWith("-");
    if (namespaceMatches(excluded ? pattern.slice(1) : pattern, namespace)) {
      enabled = !excluded;
    }
  }

  return enabled;
}

export function createDebugLogger(
  namespace: string,
  output: (...args: unknown[]) => void = console.error,
): (...args: unknown[]) => void {
  return (...args) => {
    if (isEnabled(namespace)) output(`${namespace} ${format(...args)}`);
  };
}
