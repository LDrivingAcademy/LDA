import { headers } from "next/headers";
import { cookies } from "next/headers";
import { ldaAuthSessionCookieName, revokeUserAuthSessions } from "@/lib/auth-sessions";
import { sendSupportEscalationEmail } from "@/lib/email";
import { buildLoginActivityFromHeaders, getLoginDevices } from "@/lib/login-activity";
import { isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ReportHackedRequest = {
  additionalDetails?: unknown;
  pageUrl?: unknown;
};

function roleForEmail(roles: { role: string }[] | null | undefined) {
  if (roles?.some((item) => item.role === "admin")) return "admin";
  if (roles?.some((item) => item.role === "instructor")) return "instructor";
  return "learner";
}

export async function POST(request: Request) {
  if (isRateLimited(request, "account-hacked-report", 5)) {
    return rateLimitResponse();
  }

  const body = await readJsonBody<ReportHackedRequest>(request);
  const supabase = await createClient();

  if (!supabase) {
    return jsonNoStore({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonNoStore({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const { data: roles } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["learner", "instructor", "admin"]);
  const currentHeaders = await headers();
  const currentSignIn = buildLoginActivityFromHeaders(currentHeaders);
  const devices = await getLoginDevices(supabase, user.id);
  const deviceSummary = devices.length
    ? devices
        .map((device) => {
          const locations = device.locations.length ? device.locations.join(" / ") : device.location;
          const ips = device.ipAddresses.length ? device.ipAddresses.join(" / ") : device.ipAddress || "IP unavailable";
          return [
            `- ${device.device} - ${device.browser}`,
            `  Latest sign-in: ${device.when}`,
            `  First seen: ${device.firstSeen}`,
            `  Sign-ins recorded: ${device.signInCount}`,
            `  Location: ${locations}`,
            `  IP address: ${ips}`,
            `  Unusual: ${device.isUnusual ? "yes" : "no"}`
          ].join("\n");
        })
        .join("\n\n")
    : "No saved login devices were available on the account at report time.";
  const userName =
    safeText(user.user_metadata?.full_name, "", 160) ||
    [safeText(user.user_metadata?.first_name, "", 80), safeText(user.user_metadata?.last_name, "", 80)].filter(Boolean).join(" ") ||
    safeText(user.email, "LDA account holder", 160);
  const role = roleForEmail(roles);
  const additionalDetails = safeText(body?.additionalDetails, "", 1200);

  const emailResult = await sendSupportEscalationEmail({
    role,
    name: userName,
    email: user.email ?? "",
    subject: "Account hacked report",
    message: [
      "A signed-in LDA account holder reported their account as hacked from the Account Centre.",
      "",
      `User ID: ${user.id}`,
      `Email: ${user.email ?? "Not provided"}`,
      `Role: ${role}`,
      `Report page: ${safeText(body?.pageUrl, "Not provided", 300)}`,
      "",
      "Learner notes:",
      additionalDetails || "No extra details were provided.",
      "",
      "Current request:",
      `Device: ${currentSignIn.deviceLabel}`,
      `Browser: ${currentSignIn.browserName}`,
      `Approximate location: ${currentSignIn.approximateLocation}`,
      `Country: ${currentSignIn.countryCode || "Unknown"}`,
      `IP address: ${currentSignIn.ipAddress || "Unavailable"}`,
      "",
      "Saved login devices:",
      deviceSummary
    ].join("\n"),
    assistantSummary: "Account Centre security report. Admin should review login activity, contact the user if needed, and decide whether to restrict the account.",
    urgent: true
  });

  if (typeof emailResult === "object" && emailResult && "skipped" in emailResult) {
    return jsonNoStore(
      {
        ok: false,
        error: "email_not_configured",
        message: "LDA support email is not configured, so the security report could not be sent."
      },
      { status: 503 }
    );
  }

  await revokeUserAuthSessions({
    adminClient: createAdminClient(),
    userId: user.id,
    actorUserId: user.id,
    exceptCurrentToken: (await cookies()).get(ldaAuthSessionCookieName)?.value ?? null,
    reason: "suspicious_login_reported",
    headers: currentHeaders
  });

  return jsonNoStore({
    ok: true,
    message: "Your report has been sent to LDA support. The account can now be reviewed by an admin."
  });
}
