import Link from "next/link";
import { Activity, LayoutDashboard, MessageSquareText, ShieldCheck } from "lucide-react";
import { AdminSessionAutoSignOut } from "@/components/admin-session-auto-sign-out";
import { Brand } from "@/components/brand";
import { TechnicalSupportMenu } from "@/components/technical-support-menu";
import { technicalSupportSignedOutAccessPath } from "@/lib/privileged-access-paths";

const links = [
  { href: "/technical-support", label: "Overview", icon: LayoutDashboard },
  { href: "/technical-support/feedback", label: "Support queue", icon: MessageSquareText },
  { href: "/technical-support/incidents", label: "Incidents", icon: ShieldCheck },
  { href: "/technical-support/health", label: "Site health", icon: Activity }
];

export function TechnicalSupportTopBar({ canAccessAdmin = false }: { canAccessAdmin?: boolean }) {
  return (
    <>
      <AdminSessionAutoSignOut
        role={canAccessAdmin ? "admin" : "support"}
        signedOutRole="support"
        idleMinutes={canAccessAdmin ? 10 : 15}
        warningMinutes={canAccessAdmin ? 8 : 13}
      />
      <header
        className="lda-technical-support-topbar lda-universal-topbar w-full max-w-none border-b border-zinc-900 bg-black text-white shadow-sm"
        style={{ width: "100%", maxWidth: "none", backgroundColor: "#000000", color: "#ffffff" }}
      >
        <div className="lda-universal-topbar-inner mx-auto flex w-full max-w-[1500px] items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-10">
          <Brand size="home" href="/technical-support" label="LDA technical support dashboard" />
          <div className="hidden h-8 w-px bg-white/40 sm:block" />
          <div className="hidden min-w-0 shrink sm:block">
            <div className="text-sm font-black text-white">Technical support</div>
            <div className="text-xs font-bold text-zinc-200">Triage and website monitoring</div>
          </div>
          <nav aria-label="Technical support sections" className="hidden min-w-0 flex-1 justify-center gap-2 overflow-x-auto px-1 md:flex">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="lda-technical-support-nav-link inline-flex min-w-max shrink-0 items-center gap-2 rounded border border-white/25 px-3 py-2 text-sm font-black text-white transition hover:border-red-500 hover:ring-2 hover:ring-red-500/35"
                >
                  <Icon className="shrink-0" size={16} />
                  <span className="lda-technical-support-nav-label whitespace-nowrap">{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
            {canAccessAdmin ? (
              <Link href="/admin" className="lda-technical-support-nav-link hidden rounded border border-white/25 px-3 py-2 text-sm font-black text-white transition hover:border-red-500 hover:ring-2 hover:ring-red-500/35 sm:inline-flex">
                Admin
              </Link>
            ) : null}
            <form action="/api/auth/sign-out" method="post" className="hidden sm:block">
              <input type="hidden" name="returnTo" value={technicalSupportSignedOutAccessPath} />
              <button className="lda-technical-support-signout rounded bg-red-600 px-3 py-2 text-sm font-black text-white transition hover:bg-red-500 hover:ring-2 hover:ring-red-500/35" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>
                Sign out
              </button>
            </form>
            <TechnicalSupportMenu canAccessAdmin={canAccessAdmin} />
          </div>
        </div>
      </header>
    </>
  );
}
