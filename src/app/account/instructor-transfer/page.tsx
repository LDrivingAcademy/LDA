import Link from "next/link";
import { ArrowRight, BadgeCheck, CarFront, ShieldCheck } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { getMarketplaceRolesForUser } from "@/lib/account-role-guard";
import { createClient } from "@/lib/supabase/server";
import { requestInstructorTransfer } from "./actions";

export default async function InstructorTransferPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const roles = user && supabase ? await getMarketplaceRolesForUser(supabase, user.id) : [];
  const canRequest = roles.includes("learner") && !roles.includes("instructor");

  return (
    <main className="min-h-screen bg-white text-black">
      <PageTopBar backHref="/learner-dashboard" backLabel="Back to learner dashboard" />
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_460px]">
        <div>
          <div className="inline-flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-black text-brand">
            <ShieldCheck size={16} /> Account transfer
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-normal sm:text-6xl">
            Move from learner to instructor without creating a second account.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-700">
            LDA keeps one marketplace identity per email. Once you have passed, built experience, and are ready for ADI/PDI onboarding, request a transfer from your learner account instead of signing up again.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["One email", "Learner and instructor roles cannot run at the same time."],
              ["Two-year check", "Your full licence held date is checked before review."],
              ["Admin review", "LDA reviews ADI/PDI evidence before search visibility."]
            ].map(([title, body]) => (
              <article key={title} className="rounded border border-zinc-200 bg-white p-4 shadow-sm">
                <BadgeCheck className="text-brand" />
                <h2 className="mt-3 font-black">{title}</h2>
                <p className="mt-1 text-sm leading-5 text-zinc-600">{body}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded border border-zinc-200 bg-white p-5 shadow-2xl">
          <div className="mb-5 flex items-center gap-2 text-sm font-black uppercase text-brand">
            <CarFront size={16} /> Instructor transfer request
          </div>
          {message ? <div className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-brand">{message}</div> : null}
          {!user ? (
            <Link href="/auth/login?role=learner" className="lda-pill">
              Log in to request transfer <ArrowRight size={18} />
            </Link>
          ) : !canRequest ? (
            <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
              This account cannot request a learner-to-instructor transfer because it is not an active learner-only account.
            </div>
          ) : (
            <form action={requestInstructorTransfer} encType="multipart/form-data" className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Full licence held since</span>
                <input required name="fullLicenceHeldSince" type="date" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black" />
                <span className="text-xs leading-5 text-zinc-500">This must show at least two years before LDA can review instructor transfer eligibility.</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">ADI/PDI status</span>
                  <select name="adiPdiStatus" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black">
                    <option value="PDI">PDI</option>
                    <option value="ADI">ADI</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">ADI/PDI number</span>
                  <input name="adiPdiNumber" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black" placeholder="If already issued" />
                </label>
              </div>
              <label className="grid gap-1">
                <span className="text-sm font-bold text-zinc-600">Notes for LDA review</span>
                <textarea name="notes" rows={4} className="rounded border border-zinc-300 bg-white px-3 py-3 text-black" placeholder="Tell us where you are in the ADI/PDI process." />
              </label>
              <div className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
                <h3 className="font-black">Instructor profile details</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-600">Base postcode</span>
                    <input required name="basePostcode" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black" placeholder="EN5 5XY" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-600">Hourly price</span>
                    <input required name="hourlyRate" type="number" min="0" step="1" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black" placeholder="40" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-600">Car make</span>
                    <input name="carMake" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black" placeholder="Toyota" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-bold text-zinc-600">Car model</span>
                    <input name="carModel" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black" placeholder="Yaris" />
                  </label>
                </div>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">Transmission</span>
                  <select name="transmission" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black">
                    <option value="manual">Manual</option>
                    <option value="automatic">Automatic</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">Areas covered</span>
                  <input required name="areasCovered" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black" placeholder="Barnet, Enfield, Finchley" />
                </label>
              </div>
              <div className="grid gap-3 rounded border border-zinc-200 bg-zinc-50 p-3">
                <div>
                  <h3 className="font-black">Verification documents</h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">These are required before LDA can review your transfer.</p>
                </div>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">ADI/PDI badge or certificate</span>
                  <input required name="adiPdiDocument" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-black file:text-white" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">Driving licence</span>
                  <input required name="drivingLicenceDocument" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-black file:text-white" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-bold text-zinc-600">Insurance certificate</span>
                  <input required name="insuranceDocument" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="rounded border border-zinc-300 bg-white px-3 py-3 text-black file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-black file:text-white" />
                </label>
              </div>
              <button className="lda-pill mt-2">
                Request instructor transfer <ArrowRight size={18} />
              </button>
            </form>
          )}
        </aside>
      </section>
    </main>
  );
}
