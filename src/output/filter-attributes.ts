import type { ModuleInfo } from "../types.js";

export const filterAttributes = (
  attributes: string[],
  json: ModuleInfo,
): ModuleInfo => {
  let filteredJson = json;

  if (attributes) {
    filteredJson = {};
    attributes.forEach((attribute) => {
      filteredJson[attribute] = json[attribute];
    });
  }

  return filteredJson;
};
