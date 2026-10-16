import { AdminMenu } from "@/components/admin-menu";
import { AdminSessionAutoSignOut } from "@/components/admin-session-auto-sign-out";
import { Brand } from "@/components/brand";
import { adminSignedOutAccessPath } from "@/lib/privileged-access-paths";

export function AdminTopBar({ autoSignOutOnLeave = true }: { autoSignOutOnLeave?: boolean }) {
  return (
    <>
      {autoSignOutOnLeave ? <AdminSessionAutoSignOut role="admin" idleMinutes={10} warningMinutes={8} /> : null}
      <header className="lda-admin-topbar lda-universal-topbar w-full border-b border-zinc-900 bg-black text-white shadow-sm" style={{ width: "100%", maxWidth: "none", backgroundColor: "#000000", color: "#ffffff" }}>
        <div className="lda-universal-topbar-inner flex w-full max-w-none items-center justify-between gap-3 px-3 sm:gap-6 sm:px-6 lg:px-10">
          <div className="flex min-w-0 shrink-0 items-center gap-3 sm:gap-9">
            <Brand size="home" href="/admin" label="LDA admin dashboard" />
          </div>
          <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-4">
            <div className="lda-admin-identity hidden min-w-0 max-w-[34vw] shrink text-left min-[390px]:block sm:max-w-none">
              <div className="lda-admin-director-label text-lg font-black leading-tight text-white">
                LDA Director
              </div>
              <div className="lda-admin-role-label mt-1 text-sm font-black uppercase tracking-normal text-white">
                Admin
              </div>
            </div>
            <form action="/api/auth/sign-out" method="post" className="shrink-0">
              <input type="hidden" name="returnTo" value={adminSignedOutAccessPath} />
              <button
                className="lda-admin-signout lda-red-pill rounded-full border border-red-500/60 bg-red-600 px-3 py-2 text-sm font-black text-white hover:ring-2 hover:ring-red-300 sm:px-4"
                style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
              >
                <span className="text-white" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>Sign out</span>
              </button>
            </form>
            <AdminMenu />
          </div>
        </div>
      </header>
    </>
  );
}
