import { createHash } from "crypto";
import { isDirectorAdminEmail } from "@/lib/admin-access";
import {
  buildRouteChatResponse,
  chatPermissionPolicyVersion,
  filterChatLinksForRole,
  getAllowedChatRoutes,
  type AccountAccessRole,
  type DeniedChatRoute,
  type SafeChatLink
} from "@/lib/chat-permissions";
import { getClientIp, isRateLimited, jsonNoStore, rateLimitResponse, readJsonBody, safeText } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ChatGateRequest = {
  question?: unknown;
  currentPath?: unknown;
  candidateLinks?: Array<{ label?: unknown; href?: unknown }>;
};

type ChatAccountContext = {
  role: AccountAccessRole;
  userId: string | null;
  email: string | null;
};

async function resolveChatAccountContext(): Promise<ChatAccountContext> {
  const supabase = await createClient();

  if (!supabase) {
    return { role: "visitor", userId: null, email: null };
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { role: "visitor", userId: null, email: null };
  }

  const [{ data: roles }, { data: instructorProfile }] = await Promise.all([
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase.from("instructor_profiles").select("verification_status").eq("user_id", user.id).maybeSingle()
  ]);

  const roleNames = roles?.map((role) => String(role.role)) ?? [];
  let role: AccountAccessRole = "visitor";

  if (roleNames.includes("admin") && isDirectorAdminEmail(user.email)) {
    role = "admin";
  } else if (roleNames.includes("instructor")) {
    role = instructorProfile?.verification_status === "approved" ? "instructor" : "in_progress";
  } else if (roleNames.includes("learner")) {
    role = "learner";
  }

  return { role, userId: user.id, email: user.email ?? null };
}

function sanitiseCandidateLinks(links: ChatGateRequest["candidateLinks"]) {
  if (!Array.isArray(links)) {
    return [];
  }

  return links.slice(0, 8).reduce<SafeChatLink[]>((safeLinks, link) => {
    const label = safeText(link?.label, "", 80);
    const href = safeText(link?.href, "", 240);

    if (!label || !href.startsWith("/")) {
      return safeLinks;
    }

    safeLinks.push({ label, href });
    return safeLinks;
  }, []);
}

async function logUnauthorizedChatAttempt(
  request: Request,
  context: ChatAccountContext,
  deniedRoute: DeniedChatRoute,
  question: string,
  currentPath: string
) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const ipHash = createHash("sha256").update(getClientIp(request)).digest("hex");

  await admin
    .from("chat_security_events")
    .insert({
      user_id: context.userId,
      account_role: context.role,
      attempt_type: "restricted_chat_navigation",
      requested_label: deniedRoute.label,
      requested_path: deniedRoute.href,
      source_path: currentPath,
      message_excerpt: question.slice(0, 220),
      ip_hash: ipHash
    })
    .then(() => null);
}

export async function GET() {
  const context = await resolveChatAccountContext();

  return jsonNoStore({
    role: context.role,
    policyVersion: chatPermissionPolicyVersion(),
    allowedRoutes: getAllowedChatRoutes(context.role)
  });
}

export async function POST(request: Request) {
  if (isRateLimited(request, "chat-context", 80)) {
    return rateLimitResponse();
  }

  const context = await resolveChatAccountContext();
  const body = await readJsonBody<ChatGateRequest>(request);
  const question = safeText(body?.question, "", 1200);
  const currentPath = safeText(body?.currentPath, "/", 180) || "/";
  const candidateLinks = sanitiseCandidateLinks(body?.candidateLinks);
  const routeDecision = buildRouteChatResponse(question, currentPath, context.role);

  if (routeDecision?.deniedRoute) {
    await logUnauthorizedChatAttempt(request, context, routeDecision.deniedRoute, question, currentPath);
  }

  const allowedLinks = filterChatLinksForRole(candidateLinks, context.role);

  return jsonNoStore({
    role: context.role,
    policyVersion: chatPermissionPolicyVersion(),
    routeResponse: routeDecision?.response ?? null,
    allowedLinks,
    removedLinkCount: Math.max(0, candidateLinks.length - allowedLinks.length),
    allowedRoutes: getAllowedChatRoutes(context.role)
  });
}
