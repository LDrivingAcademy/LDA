import { NextResponse } from "next/server";
import { getStripeSecretKey } from "@/lib/stripe-env";
import {
  createSubscriptionSessionToken,
  getSubscriptionSessionMaxAge,
  subscriptionSessionCookieName
} from "@/lib/subscription-session-cookie";
import { recoverLatestStripeSubscriptionForSignedInAccount } from "@/lib/subscription-return-recovery";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getRole(value: string | null): "instructor" | "learner" {
  return value === "learner" ? "learner" : "instructor";
}

function getDashboardUrl(request: Request, role: "instructor" | "learner", state: string, plan?: string, reason?: string) {
  const url = new URL(role === "learner" ? "/learner-dashboard" : "/instructor-dashboard", request.url);
  url.searchParams.set("subscription", state);

  if (plan) {
    url.searchParams.set("plan", plan);
  }

  if (reason) {
    url.searchParams.set("reason", reason);
  }

  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = getRole(url.searchParams.get("role"));
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.redirect(getDashboardUrl(request, role, "pending", undefined, "missing-supabase"));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("role", role);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle();
  const stripeSecret = getStripeSecretKey();

  try {
    const recovered = await recoverLatestStripeSubscriptionForSignedInAccount({
      supabase,
      userId: user.id,
      email: profile?.email ?? user.email,
      role,
      secretKey: stripeSecret.value
    });

    if (!recovered) {
      return NextResponse.redirect(getDashboardUrl(request, role, "checked"));
    }

    const response = NextResponse.redirect(getDashboardUrl(request, recovered.target.role, "updated", recovered.target.packageId));
    const maxAge = getSubscriptionSessionMaxAge(recovered.periodEnd);
    const token =
      recovered.target.role === "instructor"
        ? createSubscriptionSessionToken(
            {
              userId: user.id,
              role: "instructor",
              packageId: recovered.target.packageId,
              customerId: recovered.customerId,
              subscriptionId: recovered.subscriptionId,
              status: recovered.status,
              periodEnd: recovered.periodEnd
            },
            maxAge
          )
        : createSubscriptionSessionToken(
            {
              userId: user.id,
              role: "learner",
              packageId: recovered.target.packageId,
              customerId: recovered.customerId,
              subscriptionId: recovered.subscriptionId,
              status: recovered.status,
              periodEnd: recovered.periodEnd
            },
            maxAge
          );

    if (token) {
      response.cookies.set(subscriptionSessionCookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        maxAge,
        path: "/"
      });
    }

    return response;
  } catch (error) {
    console.error("Stripe subscription recovery route failed", error);
    return NextResponse.redirect(getDashboardUrl(request, role, "checked", undefined, "recovery-failed"));
  }
}
