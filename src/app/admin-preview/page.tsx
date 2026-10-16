import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, GraduationCap, Hourglass, ShieldCheck, UserRoundCheck } from "lucide-react";
import { AdminTopBar } from "@/components/admin-top-bar";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";
import { requireActiveLdaAuthSession } from "@/lib/auth-sessions";
import {
  getValidPrivilegedSessionRole,
  privilegedSessionCookieName
} from "@/lib/privileged-session-cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

const previewOptions = [
  {
    title: "View as learner",
    body: "Preview the learner dashboard, booking journey, SmartMatch, learner support, and account experience without signing in as a learner.",
    href: "/dashboard?adminPreview=learner",
    icon: GraduationCap
  },
  {
    title: "View as instructor",
    body: "Preview the instructor dashboard, verification journey, working-day tools, finance areas, and instructor support without signing in again.",
    href: "/dashboard?adminPreview=instructor",
    icon: UserRoundCheck
  },
  {
    title: "View as in progress",
    body: "Preview the holding account shown while a learner transfer or new instructor applicant is waiting for LDA document approval.",
    href: "/dashboard?adminPreview=in-progress",
    icon: Hourglass
  },
  {
    title: "Admin control room",
    body: "Return to the protected admin dashboard for platform health, bookings, revenue, payments, reviews, and operational checks.",
    href: "/admin",
    icon: ShieldCheck
  }
];

export default async function AdminPreviewPage() {
  const cookieStore = await cookies();
  const hasAdminEntry = hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value);
  const privilegedSessionRole = getValidPrivilegedSessionRole(cookieStore.get(privilegedSessionCookieName)?.value);

  if (!hasAdminEntry && privilegedSessionRole !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  if (!supabase) {
    redirect("/");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(hasAdminEntry ? "/admin-access" : "/");
  }

  const { data: adminRole } = await supabase
    .from("account_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!adminRole) {
    redirect("/");
  }

  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal?.currentLevel !== "aal2") {
    redirect("/admin-mfa");
  }

  const activeSession = await requireActiveLdaAuthSession({
    adminClient: createAdminClient(),
    cookieStore,
    headers: await headers(),
    userId: user.id,
    role: "admin",
    readOnly: true
  });

  if (!activeSession.ok) {
    redirect(hasAdminEntry ? "/admin-access" : "/");
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-black">
      <AdminTopBar />
      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="text-sm font-black uppercase text-red-200">Admin site preview</div>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-normal sm:text-5xl">
            Choose how you want to view LDA.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
            Your admin account keeps full access. These previews let you inspect the learner and instructor sides of the site without another sign-in.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:grid-cols-4 lg:px-8">
        {previewOptions.map((option) => {
          const Icon = option.icon;

          return (
            <Link key={option.href} href={option.href} className="group flex min-h-[280px] flex-col rounded border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-xl">
              <span className="grid h-14 w-14 place-items-center rounded bg-red-50 text-brand transition group-hover:bg-brand group-hover:text-white">
                <Icon size={28} />
              </span>
              <h2 className="mt-6 text-2xl font-black">{option.title}</h2>
              <p className="mt-3 text-base leading-7 text-zinc-600">{option.body}</p>
              <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-black uppercase text-brand">
                Open <ArrowRight size={16} />
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
