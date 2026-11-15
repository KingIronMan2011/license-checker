import fs from "node:fs";

export const readJson = <T = Record<string, unknown>>(jsonPath: string): T => {
  if (typeof jsonPath !== "string") {
    throw new Error("The path was not specified for the JSON file to parse.");
  }

  const jsonFileContents = fs.readFileSync(jsonPath, { encoding: "utf8" });
  return JSON.parse(jsonFileContents) as T;
};
