import { Brand } from "@/components/brand";

export function AdminAccessTopBar({ href = "/admin-access" }: { href?: string }) {
  return (
    <header
      className="lda-admin-access-topbar lda-universal-topbar w-full border-b border-zinc-900 bg-black text-white shadow-sm"
      style={{ width: "100%", maxWidth: "none", backgroundColor: "#000000", color: "#ffffff" }}
    >
      <div className="lda-universal-topbar-inner mx-auto flex w-full max-w-[1500px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <Brand size="home" href={href} label="LDA secure admin access" />
        <div className="text-right">
          <div className="text-sm font-black uppercase text-white" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>
            Secure admin access
          </div>
          <div className="mt-1 text-xs font-bold text-zinc-300" style={{ color: "#d4d4d8", WebkitTextFillColor: "#d4d4d8" }}>
            Sign in required
          </div>
        </div>
      </div>
    </header>
  );
}
