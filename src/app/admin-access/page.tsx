import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminAccessPanel } from "@/components/admin-access-panel";
import { adminEntryCookieName, hasValidAdminEntry } from "@/lib/admin-entry";

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

export default async function AdminAccessPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; identifier?: string }>;
}) {
  const { message, identifier } = await searchParams;
  const cookieStore = await cookies();
  const hasPrivateLauncherEntry = hasValidAdminEntry(cookieStore.get(adminEntryCookieName)?.value);

  if (hasPrivateLauncherEntry) {
    const query = new URLSearchParams();
    if (message) query.set("message", message);
    if (identifier) query.set("identifier", identifier);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    redirect(`/director-master-key-lda-admin-9f4e7c2b6a/access${suffix}`);
  }

  return <AdminAccessPanel hasPrivateLauncherEntry={hasPrivateLauncherEntry} identifier={identifier} message={message} />;
}
