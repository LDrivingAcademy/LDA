import { redirect } from "next/navigation";
import { BadgeCheck, GraduationCap, UsersRound } from "lucide-react";
import { PageTopBar } from "@/components/page-top-bar";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type PupilRow = {
  name: string;
  status: "Active" | "Test-ready";
  pickup: string;
  nextLesson: string;
  progress: string;
  focus: string;
};

const pupils: PupilRow[] = [
  { name: "Mia Thompson", status: "Active", pickup: "EN5 5XY", nextLesson: "12 Jun, 08:00", progress: "62% complete", focus: "Junction confidence" },
  { name: "Owen Patel", status: "Active", pickup: "N12 8QP", nextLesson: "14 Jun, 14:00", progress: "48% complete", focus: "Roundabouts" },
  { name: "Grace Lee", status: "Active", pickup: "N20 0AA", nextLesson: "17 Jun, 18:00", progress: "55% complete", focus: "Meeting traffic" },
  { name: "Aaliyah Grant", status: "Test-ready", pickup: "NW7 2EU", nextLesson: "10 Jun, 16:00", progress: "92% complete", focus: "Mock test route" },
  { name: "Noah Evans", status: "Test-ready", pickup: "EN4 9AB", nextLesson: "15 Jun, 13:00", progress: "89% complete", focus: "Independent driving" }
];

function PupilTable({ title, rows }: { title: string; rows: PupilRow[] }) {
  return (
    <section className="rounded border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 p-5">
        <div>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-1 text-sm font-bold text-zinc-500">{rows.length} pupils</p>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded bg-red-50 text-brand">
          {title === "Active pupils" ? <UsersRound size={24} /> : <BadgeCheck size={24} />}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead className="bg-zinc-50 text-xs font-black uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-4">Pupil</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Pickup</th>
              <th className="px-5 py-4">Next lesson</th>
              <th className="px-5 py-4">Progress</th>
              <th className="px-5 py-4">Current focus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-sm font-bold text-zinc-700">
            {rows.map((pupil) => (
              <tr key={pupil.name} className="align-top hover:bg-zinc-50">
                <td className="px-5 py-4 text-base font-black text-black">{pupil.name}</td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${pupil.status === "Test-ready" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-sky-50 text-sky-800 ring-1 ring-sky-200"}`}>
                    {pupil.status}
                  </span>
                </td>
                <td className="px-5 py-4">{pupil.pickup}</td>
                <td className="px-5 py-4">{pupil.nextLesson}</td>
                <td className="px-5 py-4">{pupil.progress}</td>
                <td className="px-5 py-4">{pupil.focus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function PupilManagementPage() {
  const supabase = await createClient();

  if (hasSupabaseConfig() && supabase) {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/auth/login?role=instructor");
    }

    const { data: roles } = await supabase.from("account_roles").select("role").eq("user_id", user.id);
    const isInstructor = roles?.some((accountRole) => accountRole.role === "instructor") ?? false;

    if (!isInstructor) {
      redirect("/dashboard");
    }
  }

  const activePupils = pupils.filter((pupil) => pupil.status === "Active");
  const testReadyPupils = pupils.filter((pupil) => pupil.status === "Test-ready");

  return (
    <>
      <PageTopBar backHref="/dashboard" backLabel="Back to dashboard" />
      <main className="min-h-screen bg-white text-black">
        <section className="border-b border-zinc-200 bg-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/60 bg-red-500/15 px-4 py-2 text-sm font-black text-red-100">
              <GraduationCap size={17} /> Pupil management
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-normal sm:text-6xl">Active and test-ready pupils.</h1>
            <p className="mt-4 max-w-3xl text-lg font-semibold leading-8 text-zinc-300">
              A focused instructor table for pupils currently learning and pupils ready for practical test preparation.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2">
            <article className="rounded border border-zinc-200 bg-zinc-50 p-5">
              <div className="text-sm font-black uppercase text-zinc-500">Active pupils</div>
              <div className="mt-2 text-4xl font-black">{activePupils.length}</div>
            </article>
            <article className="rounded border border-zinc-200 bg-zinc-50 p-5">
              <div className="text-sm font-black uppercase text-zinc-500">Test-ready pupils</div>
              <div className="mt-2 text-4xl font-black">{testReadyPupils.length}</div>
            </article>
          </div>
          <PupilTable title="Active pupils" rows={activePupils} />
          <PupilTable title="Test-ready pupils" rows={testReadyPupils} />
        </section>
      </main>
    </>
  );
}
