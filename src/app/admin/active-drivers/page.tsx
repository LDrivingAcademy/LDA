import Link from "next/link";
import { Activity, MapPinned, Navigation, ShieldAlert, UsersRound, type LucideIcon } from "lucide-react";
import { AdminActiveDriversMap } from "@/components/admin-active-drivers-map";
import { AdminPageHeader } from "@/components/admin-page-header";
import { AdminTopBar } from "@/components/admin-top-bar";
import { requireAdminDashboardClient } from "@/lib/admin-dashboard";
import { recordAuthAudit } from "@/lib/auth-sessions";
import { readAdminActiveDriverLocations } from "@/lib/admin-active-driver-locations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Active Drivers | LDA Admin",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function AdminActiveDriversPage() {
  const { supabase, user } = await requireAdminDashboardClient();
  const admin = createAdminClient();
  const readClient = admin ?? supabase;
  const locationPayload = await readAdminActiveDriverLocations(readClient);

  await recordAuthAudit({
    adminClient: admin,
    actorUserId: user.id,
    subjectUserId: user.id,
    role: "admin",
    action: "admin.live_location.read",
    targetType: "instructor_live_locations",
    metadata: {
      driverCount: locationPayload.drivers.length,
      staleSignedOnCount: locationPayload.staleSignedOnInstructors.length
    }
  });

  const liveNow = locationPayload.drivers.length;
  const seenToday = locationPayload.drivers.length + locationPayload.staleSignedOnInstructors.length;
  const lastUpdate = locationPayload.drivers[0]?.recordedAt
    ? new Date(locationPayload.drivers[0].recordedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })
    : "No live update";

  return (
    <main className="min-h-screen bg-black text-white">
      <AdminTopBar />
      <AdminPageHeader
        eyebrow={<span className="inline-flex items-center gap-2"><MapPinned size={17} /> Active driver safety map</span>}
        title="Live instructor location control"
        description="Admin-only map for instructors who have shared a device location today. Use it to focus an instructor on Google Maps, verify their last known point, and support safety escalation if needed."
        right={(
          <Link href="/admin/instructors" className="rounded-full border border-red-500/40 px-5 py-3 text-sm font-black text-red-100 hover:border-red-400 hover:text-white">
            Instructor register
          </Link>
        )}
      />

      <section className="mx-auto max-w-7xl px-4 py-8">
        {locationPayload.errors.length ? (
          <div className="mb-5 rounded border border-red-500/40 bg-red-600 px-4 py-3 text-sm font-black text-white">
            {locationPayload.errors[0]}
          </div>
        ) : null}

        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Activity} label="Live now" value={liveNow} detail={`Fresh signed-on pings within ${locationPayload.liveWindowSeconds} seconds`} />
          <Metric icon={UsersRound} label="Signed on" value={seenToday} detail="Instructors currently in a work session" />
          <Metric icon={Navigation} label="Latest update" value={lastUpdate} detail="Most recent instructor device ping" />
          <Metric icon={ShieldAlert} label="Access" value="Admin only" detail="Protected by the admin MFA route guard" />
        </div>

        <AdminActiveDriversMap
          initialDrivers={locationPayload.drivers}
          initialStaleSignedOnInstructors={locationPayload.staleSignedOnInstructors}
          liveWindowSeconds={locationPayload.liveWindowSeconds}
        />
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: number | string; detail: string }) {
  return (
    <article className="rounded border border-zinc-800 bg-zinc-950 p-5">
      <Icon className="text-brand" />
      <div className="mt-4 text-sm font-bold text-zinc-400">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      <p className="mt-1 text-sm font-semibold leading-6 text-zinc-400">{detail}</p>
    </article>
  );
}
