import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountCentre } from "@/components/account-centre";
import { AdminTopBar } from "@/components/admin-top-bar";
import { LoginActivityReporter } from "@/components/login-activity-reporter";
import { isDirectorAdminEmail } from "@/lib/admin-access";
import { requireSignedInPage } from "@/lib/page-auth";

type AccountPageProps = {
  searchParams?: Promise<{ message?: string }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams;
  const { supabase, user } = await requireSignedInPage("Sign in before opening your account.");
  const [rolesResult, learnerProfileResult] = await Promise.all([
    supabase.from("account_roles").select("role").eq("user_id", user.id),
    supabase
      .from("learner_profiles")
      .select("provisional_licence_confirmed_at")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);
  const roleNames = rolesResult.data?.map((role) => String(role.role)) ?? [];
  const hasAdminAccount = roleNames.includes("admin") && isDirectorAdminEmail(user.email);
  const hasSupportAccount = roleNames.includes("support");
  const hasInstructorAccount = roleNames.includes("instructor");
  const hasLearnerAccount =
    !hasInstructorAccount &&
    (roleNames.includes("learner") ||
      Boolean(learnerProfileResult.data) ||
      (!roleNames.includes("admin") && !hasSupportAccount));

  if (hasSupportAccount && !hasAdminAccount) {
    redirect("/technical-support");
  }

  if (hasAdminAccount) {
    return (
      <>
        <LoginActivityReporter shouldRecord />
        <AdminTopBar />
        <main className="min-h-screen bg-white px-4 py-10 text-black sm:px-6 lg:px-8">
          <section className="mx-auto max-w-4xl rounded border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-black uppercase text-brand">LDA Admin Account</div>
            <h1 className="mt-2 text-4xl font-black tracking-normal">Admin account centre</h1>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-zinc-600">
              This area is reserved for the signed-in admin account. Learner, instructor, and in-progress account centres are not available from admin preview mode.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <AdminAccountLink href="/admin" label="Admin dashboard" />
              <AdminAccountLink href="/admin-preview" label="Site preview selector" />
              <AdminAccountLink href="/admin/analytics" label="Owner analytics" />
              <AdminAccountLink href="/admin-mfa?manage=1" label="Authenticator MFA" />
            </div>
            <div className="mt-6 rounded border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-black uppercase text-zinc-500">Signed-in admin</div>
              <div className="mt-1 text-lg font-black">{user.email ?? "Admin account"}</div>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <LoginActivityReporter shouldRecord />
      <AccountCentre
        message={params?.message}
        accountRole={hasInstructorAccount ? "instructor" : "learner"}
        showLearnerLicenceVerification={hasLearnerAccount}
        provisionalLicenceConfirmedAt={learnerProfileResult.data?.provisional_licence_confirmed_at ?? null}
      />
    </>
  );
}

function AdminAccountLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded border border-zinc-200 bg-zinc-50 px-4 py-4 text-base font-black text-black hover:border-red-500 hover:bg-red-50">
      {label}
    </Link>
  );
}
