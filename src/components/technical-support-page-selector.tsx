import Link from "next/link";
import type { ReactNode } from "react";

type SearchValue = string | string[] | undefined;

type TechnicalSupportPageSelectorProps = {
  basePath: string;
  currentPage: number;
  itemLabel: string;
  pageParam: string;
  pageSize: number;
  searchParams?: Record<string, SearchValue>;
  totalItems: number;
};

export function TechnicalSupportPageSelector({
  basePath,
  currentPage,
  itemLabel,
  pageParam,
  pageSize,
  searchParams = {},
  totalItems
}: TechnicalSupportPageSelectorProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const hrefForPage = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key === pageParam || value === undefined) return;
      const firstValue = Array.isArray(value) ? value[0] : value;
      if (firstValue) params.set(key, firstValue);
    });
    if (page > 1) params.set(pageParam, String(page));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav
      aria-label={`${itemLabel} pages`}
      className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-950 p-3"
    >
      <div className="text-sm font-black text-zinc-300">
        Page {currentPage} of {totalPages}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PageLink disabled={currentPage <= 1} href={hrefForPage(Math.max(1, currentPage - 1))}>
          Previous
        </PageLink>
        {pages.map((page) => (
          <PageLink key={page} active={page === currentPage} href={hrefForPage(page)}>
            {page}
          </PageLink>
        ))}
        <PageLink disabled={currentPage >= totalPages} href={hrefForPage(Math.min(totalPages, currentPage + 1))}>
          Next
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  active = false,
  children,
  disabled = false,
  href
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  href: string;
}) {
  if (disabled) {
    return (
      <span className="rounded border border-zinc-900 px-3 py-2 text-sm font-black text-zinc-600">
        {children}
      </span>
    );
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`rounded border px-3 py-2 text-sm font-black transition ${
        active
          ? "border-red-500 bg-red-600 text-white"
          : "border-zinc-700 bg-black text-zinc-200 hover:border-red-500 hover:text-white"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}
