import fs from "node:fs";
import { legacyClientScriptNames, legacyScriptPaths } from "./gutguard-data";

export function getLegacyClientScripts() {
  return legacyClientScriptNames.map((scriptName) => ({
    name: scriptName,
    content: fs.readFileSync(legacyScriptPaths[scriptName], "utf8")
  }));
}
