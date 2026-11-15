export function firstDefined<T>(
  ...values: Array<T | undefined>
): T | undefined {
  for (const value of values) {
    if (typeof value !== "undefined") {
      return value;
    }
  }
  return undefined;
}
