import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../");

export const legacyHtmlPath = path.join(projectRoot, "gutguard_90day_plan (4).html");

export const legacyScriptPaths: Record<string, string> = {
  "supabase-config.js": path.join(projectRoot, "supabase-config.js"),
  "plan-model.js": path.join(projectRoot, "plan-model.js"),
  "plan-api.js": path.join(projectRoot, "plan-api.js"),
  "gutguard-admin.js": path.join(projectRoot, "gutguard-admin.js"),
  "gutguard-app.js": path.join(projectRoot, "gutguard-app.js")
};

export const legacyClientScriptNames = [
  "supabase-config.js",
  "plan-model.js",
  "plan-api.js",
  "gutguard-admin.js",
  "gutguard-app.js"
] as const;
