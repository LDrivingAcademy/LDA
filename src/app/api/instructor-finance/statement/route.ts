import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LessonRecord = {
  booking_reference: string | null;
  learner_email: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  starts_at: string | null;
  lesson_price_pence: number | null;
  payment_status: string | null;
  status: string | null;
};

function text(value: string) {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7e]/g, "");
}

function formatPounds(pence: number) {
  return `GBP ${(pence / 100).toFixed(2)}`;
}

function getMonthRange(value: string | null) {
  const fallback = new Date();
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : fallback.getFullYear();
  const month = match ? Number(match[2]) - 1 : fallback.getMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
  const label = `${start.toLocaleString("en-GB", { month: "long", timeZone: "UTC" })} ${year}`;
  return { start, end, label, value: `${year}-${String(month + 1).padStart(2, "0")}` };
}

function pdfLine(y: number, value: string, size = 10, x = 50) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${text(value)}) Tj ET\n`;
}

function buildPdf(lines: string[]) {
  const pageHeight = 842;
  const content = lines.join("");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}endstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return new Response("Finance statement storage is not configured.", { status: 503 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Sign in as an instructor to download statements.", { status: 401 });
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    return new Response("Use an approved instructor account to download statements.", { status: 403 });
  }

  const url = new URL(request.url);
  const { start, end, label, value } = getMonthRange(url.searchParams.get("month"));
  const { data: records, error } = await admin
    .from("lesson_booking_records")
    .select("booking_reference,learner_email,instructor_id,instructor_name,starts_at,lesson_price_pence,payment_status,status")
    .eq("instructor_id", user.id)
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .eq("payment_status", "paid")
    .order("starts_at", { ascending: true });

  if (error) {
    return new Response("Statement records could not be loaded.", { status: 503 });
  }

  const rows = (records ?? []) as LessonRecord[];
  const gross = rows.reduce((sum, row) => sum + Math.max(0, row.lesson_price_pence ?? 0), 0);
  const platformFee = Math.round(gross * 0.1);
  const net = gross - platformFee;
  const instructorName = rows.find((row) => row.instructor_name)?.instructor_name ?? "LDA instructor";
  const lines: string[] = [];
  let y = 792;

  lines.push(pdfLine(y, "L Driving Academy - Instructor Monthly Statement", 18));
  y -= 28;
  lines.push(pdfLine(y, `Statement month: ${label}`, 12));
  y -= 18;
  lines.push(pdfLine(y, `Instructor: ${instructorName}`, 11));
  y -= 18;
  lines.push(pdfLine(y, `Generated: ${new Date().toISOString()}`, 9));
  y -= 30;
  lines.push(pdfLine(y, `Gross lesson value: ${formatPounds(gross)}`, 11));
  y -= 16;
  lines.push(pdfLine(y, `Estimated LDA platform fee: ${formatPounds(platformFee)}`, 11));
  y -= 16;
  lines.push(pdfLine(y, `Estimated instructor net: ${formatPounds(net)}`, 11));
  y -= 28;
  lines.push(pdfLine(y, "Lesson lines", 13));
  y -= 18;

  if (!rows.length) {
    lines.push(pdfLine(y, "No paid lesson records were found for this month.", 10));
  } else {
    for (const row of rows.slice(0, 30)) {
      const date = row.starts_at ? new Date(row.starts_at).toLocaleDateString("en-GB") : "Unknown date";
      const learner = row.learner_email ? `${row.learner_email.slice(0, 3)}***` : "Learner";
      const amount = formatPounds(Math.max(0, row.lesson_price_pence ?? 0));
      lines.push(pdfLine(y, `${date} | ${row.booking_reference ?? "No reference"} | ${learner} | ${amount}`, 9));
      y -= 14;
    }
  }

  y = Math.max(y - 28, 80);
  lines.push(pdfLine(y, "This statement is for instructor record keeping. It is not tax advice.", 9));
  y -= 14;
  lines.push(pdfLine(y, "Refunds, disputes, or later adjustments may alter final payable totals.", 9));

  const pdf = buildPdf(lines);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="lda-instructor-statement-${value}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}
