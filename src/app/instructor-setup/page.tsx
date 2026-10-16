import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, CreditCard, FileText, Settings, Wallet } from "lucide-react";
import { Brand } from "@/components/brand";
import { saveInstructorSetupProfileAction } from "@/app/instructor-setup/actions";
import type { InstructorFinanceProfile } from "@/lib/instructor-finance-profile";
import { canUseMarketplaceRole, getMarketplaceRoleState } from "@/lib/account-route-guard";
import { getInstructorSetupReadiness, refreshInstructorSetupAvailability } from "@/lib/instructor-setup-readiness";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Set Up Instructor Account | L Driving Academy",
  description: "Complete approved LDA instructor setup before learner-facing availability goes live.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

type InstructorSetupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(searchParams: Record<string, string | string[] | undefined> | undefined, key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function areasValue(value?: string[] | null) {
  return value?.filter(Boolean).join(", ") ?? "";
}

function poundsValue(value?: number | null) {
  return typeof value === "number" && value > 0 ? (value / 100).toFixed(2) : "";
}

function splitAccountName(value?: string | null) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? ""
  };
}

export default async function InstructorSetupPage({ searchParams }: InstructorSetupPageProps) {
  const params = searchParams ? await searchParams : {};
  const message = getSearchParam(params, "message");
  const supabase = await createClient();
  const admin = createAdminClient();

  if (!supabase || !admin) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <section className="mx-auto max-w-4xl rounded border border-zinc-800 bg-zinc-950 p-6">
          <h1 className="text-3xl font-black">Connect Supabase to use instructor setup.</h1>
        </section>
      </main>
    );
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

  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin
      .from("instructor_profiles")
      .select("display_name,verification_status,hourly_rate_pence,base_postcode,areas_covered,transmission,car_make,car_model,stripe_account_id,learner_availability_paused,learner_availability_pause_reason")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.auth.admin.getUserById(user.id)
  ]);
  const finance = (authUser.user?.user_metadata?.lda_instructor_finance ?? {}) as InstructorFinanceProfile;
  const readiness = getInstructorSetupReadiness(profile, finance);
  const accountName = splitAccountName(profile?.display_name);

  await refreshInstructorSetupAvailability({
    db: admin,
    userId: user.id,
    profile,
    finance
  });

  return (
    <main className="min-h-screen bg-white text-black">
      <header className="lda-universal-topbar border-b border-zinc-800 bg-ink text-white">
        <div className="lda-universal-topbar-inner flex w-full items-center justify-between gap-4 px-[15px]">
          <div className="flex min-w-0 items-center gap-5">
            <Brand size="home" />
            <div>
              <div className="text-sm font-bold text-red-200">Instructor account</div>
              <div className="mt-1 text-xl font-black">Set up account</div>
            </div>
          </div>
          <Link href="/instructor-dashboard" className="inline-flex items-center gap-2 text-sm font-black text-white hover:text-brand">
            <ArrowLeft size={17} /> Back to instructor dashboard
          </Link>
        </div>
      </header>

      <section className="bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
            <Settings size={17} /> Step 1 of 3
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-normal sm:text-6xl">
            Complete your instructor profile before learner bookings go live.
          </h1>
          <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
            Your instructor account is approved. LDA keeps learner-facing search paused until finance, tax, payment, pricing, and learner-facing profile details are ready.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {message ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-5">
          {readiness.checklist.map((item) => (
            <Link key={item.key} href={item.href} className="rounded border border-zinc-200 bg-white p-4 shadow-sm hover:ring-2 hover:ring-brand">
              {item.complete ? <CheckCircle2 className="text-emerald-600" /> : <CircleAlert className="text-amber-600" />}
              <div className="mt-4 text-base font-black">{item.label}</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-zinc-600">{item.detail}</p>
            </Link>
          ))}
        </div>

        <div className={`rounded border p-5 text-sm font-bold leading-6 ${readiness.complete ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          {readiness.complete
            ? "Your saved setup is complete. You can review each step and update the information whenever necessary."
            : `${readiness.completeCount}/${readiness.totalCount} setup areas completed. Your instructor profile stays hidden from learner searches until every item is complete.`}
        </div>

        <section id="profile" className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase text-brand">Profile and pricing</div>
              <h2 className="mt-2 text-3xl font-black">Learner-facing instructor details.</h2>
              <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-zinc-600">
                Use your legal government name only. No aliases, shortened names, or nicknames. Your postcode helps LDA anchor your operating area, and learners find you through the areas you choose to cover.
              </p>
            </div>
            <CreditCard className="text-brand" />
          </div>
          <form action={saveInstructorSetupProfileAction} className="mt-6 grid gap-4">
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-950">
              <div className="font-black uppercase text-brand">Account name</div>
              This must match your real first name and last name on official documents. LDA may use it for verification, learner records, and instructor profile checks.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-black">
                First name
                <input name="firstName" defaultValue={accountName.firstName} autoComplete="given-name" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Last name
                <input name="lastName" defaultValue={accountName.lastName} autoComplete="family-name" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
              </label>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-black">
                Home postcode
                <input name="basePostcode" defaultValue={profile?.base_postcode ?? ""} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
                <span className="text-xs font-bold leading-5 text-zinc-600">
                  Use the postcode you operate from locally. Learners do not need to see your full home address.
                </span>
              </label>
              <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
                LDA uses your postcode with your covered areas to match learners searching near your operating location.
              </div>
            </div>
            <label className="grid gap-2 text-sm font-black">
              Areas covered
              <input name="areasCovered" defaultValue={areasValue(profile?.areas_covered)} placeholder="Barnet, Finchley, Enfield" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
              <span className="text-xs font-bold leading-5 text-zinc-600">
                Add the towns, boroughs, or local areas you want learners to find you under.
              </span>
            </label>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-black">
                Transmission
                <select name="transmission" defaultValue={profile?.transmission === "manual" ? "manual" : "automatic"} className="rounded border border-zinc-300 px-3 py-3 font-bold">
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-black">
                Car make
                <input name="carMake" defaultValue={profile?.car_make ?? ""} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
              </label>
              <label className="grid gap-2 text-sm font-black">
                Car model
                <input name="carModel" defaultValue={profile?.car_model ?? ""} className="rounded border border-zinc-300 px-3 py-3 font-bold" />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-black md:max-w-xs">
              Hourly price
              <input name="hourlyRate" defaultValue={poundsValue(profile?.hourly_rate_pence)} inputMode="decimal" placeholder="45.00" className="rounded border border-zinc-300 px-3 py-3 font-bold" />
            </label>
            <button type="submit" className="lda-pill lda-pill-sm self-start">
              Save and continue to Step 2 <ArrowRight size={17} />
            </button>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <SetupLinkCard icon={Wallet} badge="Step 2" title="Finance and payout setup" body="Add or edit payout bank details and Stripe payout readiness." href="/instructor-setup/finance" />
          <SetupLinkCard icon={FileText} badge="Step 3" title="Tax profile setup" body="Save UTR, National Insurance, VAT status, and finance record details." href="/instructor-setup/tax" />
        </section>
      </section>
    </main>
  );
}

function SetupLinkCard({
  icon: Icon,
  badge,
  title,
  body,
  href
}: {
  icon: typeof Wallet;
  badge?: string;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <Link href={href} className="rounded border border-zinc-200 bg-white p-5 shadow-sm hover:ring-2 hover:ring-brand">
      <div className="flex items-start justify-between gap-3">
        <Icon className="text-brand" />
        {badge ? (
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-black uppercase text-white">
            {badge}
          </span>
        ) : null}
      </div>
      <h2 className="mt-4 text-2xl font-black">{title}</h2>
      <p className="mt-2 text-sm font-bold leading-6 text-zinc-600">{body}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand">
        Open setup <ArrowRight size={16} />
      </span>
    </Link>
  );
}
