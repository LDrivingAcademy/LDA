import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, Star } from "lucide-react";
import type { Instructor } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { Badge, secondaryButtonClass } from "./ui";

export function InstructorCard({ instructor }: { instructor: Instructor }) {
  return (
    <article className="grid gap-4 rounded border border-border bg-card p-4 sm:grid-cols-[120px_1fr_auto]">
      <Image src={instructor.photoUrl} alt={`${instructor.displayName} profile photo`} width={120} height={120} className="aspect-square rounded object-cover" />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-black">{instructor.displayName}</h2>
          <Badge tone="good">Verified</Badge>
          <Badge>{instructor.adiPdiStatus}</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{instructor.bio}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1"><Star size={16} aria-hidden="true" /> {instructor.ratingAverage} ({instructor.reviewCount})</span>
          <span className="inline-flex items-center gap-1"><MapPin size={16} aria-hidden="true" /> {instructor.areasCovered.join(", ")}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays size={16} aria-hidden="true" /> {instructor.nextAvailability[0]}</span>
        </div>
      </div>
      <div className="flex min-w-36 flex-col items-start justify-between gap-3 sm:items-end">
        <div className="text-left sm:text-right">
          <div className="text-2xl font-black">{formatMoney(instructor.hourlyRatePence)}</div>
          <div className="text-xs font-semibold uppercase text-muted">per hour</div>
          <div className="mt-1 text-sm font-semibold capitalize">{instructor.transmission}</div>
        </div>
        <Link href="/learner/search" className={secondaryButtonClass}>View profile</Link>
      </div>
    </article>
  );
}
