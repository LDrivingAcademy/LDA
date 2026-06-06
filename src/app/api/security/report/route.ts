import { NextResponse } from "next/server";

const MAX_REPORT_BYTES = 12_000;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body = await request.text();

  if (body.length > MAX_REPORT_BYTES) {
    return NextResponse.json({ error: "Security report too large" }, { status: 413 });
  }

  if (contentType.includes("json")) {
    try {
      const report = JSON.parse(body);
      console.info("LDA security policy report", {
        blocked: report?.["csp-report"]?.["blocked-uri"] ?? report?.body?.blockedURL ?? "unknown",
        directive: report?.["csp-report"]?.["violated-directive"] ?? report?.body?.effectiveDirective ?? "unknown",
        source: report?.["csp-report"]?.["source-file"] ?? report?.body?.sourceFile ?? "unknown"
      });
    } catch {
      console.info("LDA security policy report", { format: "invalid-json" });
    }
  }

  return new NextResponse(null, { status: 204 });
}
