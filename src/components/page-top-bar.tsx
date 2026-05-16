import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";

type PageTopBarProps = {
  backHref?: string;
  backLabel?: string;
};

export function PageTopBar({ backHref = "/", backLabel = "Back to homepage" }: PageTopBarProps) {
  return (
    <header className="w-full bg-black px-4 py-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Brand size="home" />
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-white hover:text-white hover:ring-2 hover:ring-brand"
        >
          <ArrowLeft size={16} /> {backLabel}
        </Link>
      </div>
    </header>
  );
}
