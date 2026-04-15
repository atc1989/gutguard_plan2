import fs from "node:fs";
import { NextResponse } from "next/server";
import { legacyScriptPaths } from "@/lib/gutguard-data";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> }
) {
  const { name } = await context.params;
  const scriptPath = legacyScriptPaths[name];

  if (!scriptPath) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contents = fs.readFileSync(scriptPath, "utf8");

  return new NextResponse(contents, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
