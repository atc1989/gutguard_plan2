import fs from "node:fs";
import { legacyHtmlPath, legacyClientScriptNames, legacyScriptPaths } from "./gutguard-data";

const legacyHtml = fs.readFileSync(legacyHtmlPath, "utf8");

function getMatch(pattern: RegExp, label: string) {
  const match = legacyHtml.match(pattern);

  if (!match) {
    throw new Error(`Unable to locate the ${label} markup in the legacy Gutguard HTML.`);
  }

  return match[1].replace(/<script\b[\s\S]*?<\/script>/gi, "").trim();
}

export function getLegacyFormMarkup() {
  return getMatch(
    /<!-- FORM SCREEN -->([\s\S]*?)<!-- MODAL: ADD SUB-MEMBER -->/i,
    "form screen"
  );
}

export function getLegacyAddMemberModalMarkup() {
  return getMatch(
    /<!-- MODAL: ADD SUB-MEMBER -->([\s\S]*?)<footer class="site-footer">/i,
    "add member modal"
  );
}

export function getLegacyFooterMarkup() {
  return getMatch(
    /(<footer class="site-footer">[\s\S]*?<div class="toast" id="toast" role="status" aria-live="polite"><\/div>)/i,
    "footer"
  );
}

export function getLegacyClientScripts() {
  return legacyClientScriptNames.map((scriptName) => ({
    name: scriptName,
    content: fs.readFileSync(legacyScriptPaths[scriptName], "utf8")
  }));
}
