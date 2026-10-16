import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InstructorFinanceWorkspace, type InstructorFinanceWorkspaceMode } from "@/components/instructor-finance-workspace";
import { PageTopBar } from "@/components/page-top-bar";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Instructor Account Setup | L Driving Academy",
  description: "Complete finance, payout, and tax setup for an approved LDA instructor account.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

type InstructorSetupStepPageProps = {
  params: Promise<{ step: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(searchParams: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function getStepMode(step: string): InstructorFinanceWorkspaceMode | null {
  if (step === "finance") {
    return "setup-payout";
  }
  if (step === "tax") {
    return "setup-tax";
  }
  return null;
}

export default async function InstructorSetupStepPage({ params, searchParams }: InstructorSetupStepPageProps) {
  const { step } = await params;
  const mode = getStepMode(step);
  if (!mode) {
    notFound();
  }

  const supabase = await createClient();
  if (!supabase) {
    redirect("/auth/login?role=instructor");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login?role=instructor");
  }

  const roleState = await getMarketplaceRoleState(supabase, user.id);
  if (!canUseMarketplaceRole(roleState, "instructor")) {
    redirect(roleState.effectiveRole === "instructor" ? "/instructor-verification?from=dashboard" : "/learner-dashboard");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const message = getSearchParam(resolvedSearchParams, "message") ?? "";
  const backHref = step === "tax" ? "/instructor-setup/finance" : "/instructor-setup";
  const backLabel = step === "tax" ? "Back to Step 2" : "Back to Step 1";

  return (
    <>
      <PageTopBar
        backHref={backHref}
        backLabel={backLabel}
        brandHref="/instructor-dashboard"
        brandLabel="Instructor dashboard"
      />
      <InstructorFinanceWorkspace mode={mode} initialMessage={message} />
    </>
  );
}
