import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { CURRENT_TERMS_LABEL } from "@/lib/terms-version";

type TermsUpdateBannerProps = {
  next?: string;
};

export function TermsUpdateBanner({ next = "/dashboard" }: TermsUpdateBannerProps) {
  const href = `/terms/update?next=${encodeURIComponent(next)}`;

  return (
    <section className="border-b border-amber-200 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex gap-3">
          <FileText className="mt-1 shrink-0 text-amber-700" size={22} />
          <div>
            <h2 className="text-lg font-black">Updated Terms and Conditions need your acceptance.</h2>
            <p className="mt-1 text-sm font-bold leading-6">
              {CURRENT_TERMS_LABEL}. Please review and accept the latest terms before booking lessons or using live work features.
            </p>
          </div>
        </div>
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-black px-5 py-2 text-sm font-black text-white hover:bg-zinc-800">
          Review terms <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
