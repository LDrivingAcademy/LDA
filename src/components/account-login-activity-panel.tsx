import { ChevronDown, MapPin, ShieldCheck } from "lucide-react";
import type { LoginDeviceActivity } from "@/lib/login-activity";

type AccountLoginActivityPanelProps = {
  loginActivities?: LoginDeviceActivity[];
  accountRole?: "learner" | "instructor";
};

function formatActivityTime(value: string) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function formatActivityDate(value: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    dateStyle: "medium"
  });
}

function formatActivityClock(value: string) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatIpAddress(value: string) {
  return value ? `IP address: ${value}` : "IP address unavailable";
}

export function AccountLoginActivityPanel({
  loginActivities,
  accountRole = "learner"
}: AccountLoginActivityPanelProps) {
  const roleLabel = accountRole === "instructor" ? "instructor" : "learner";
  const activity = (loginActivities ?? []).map((item) => ({
    ...item,
    date: formatActivityDate(item.when),
    time: formatActivityClock(item.when),
    when: formatActivityTime(item.when),
    firstSeenLabel: formatActivityTime(item.firstSeen)
  }));
  const hasUnusualLoginActivity = activity.some((item) => item.isUnusual);

  return (
    <article className="rounded border border-zinc-200 bg-white p-5 shadow-sm">
      <MapPin className="text-brand" />
      <h2 className="mt-4 text-2xl font-black">Your Log In Activities</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Every successful {roleLabel} sign-in that LDA can record is saved against your account. Each device entry shows the device type, browser, latest sign-in time, first seen time, approximate location, and IP address. Browser security does not expose the private computer name, so LDA shows the safest reliable device label available from the sign-in.
      </p>
      {hasUnusualLoginActivity ? (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm font-black leading-6 text-red-950">
          One or more sign-ins appears outside the UK or from an unusual location. If this was not you, use the security report in Account Centre settings so LDA can review it.
        </div>
      ) : null}
      <div className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold leading-6 text-zinc-700">
        <ShieldCheck className="mr-2 inline text-brand" size={16} />
        If you recognise every device below, no action is needed. If a random device or country appears, use Report account as hacked in the Account Centre.
      </div>
      <div className="mt-5 grid gap-3">
        {activity.length === 0 ? (
          <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold leading-6 text-zinc-700">
            No saved login devices yet. Sign out and sign back in on this device, then refresh this page. If it still does not appear, contact LDA support so the login activity store can be checked.
          </div>
        ) : null}
        {activity.map((item) => {
          const locationLabel = item.locations.length ? item.locations.join(" / ") : item.location;
          const ipLabel = item.ipAddresses.length ? item.ipAddresses.join(" / ") : item.ipAddress;

          return (
            <details key={item.id} className={`group rounded border text-sm ${item.isUnusual ? "border-red-200 bg-red-50" : "border-zinc-200 bg-zinc-50"}`}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 marker:hidden [&::-webkit-details-marker]:hidden">
                <div className="min-w-0">
                  <div className="font-black">{item.device} - {item.browser}</div>
                  <div className="mt-1 text-zinc-600">Latest sign-in: {item.date}{item.time ? ` at ${item.time}` : ""}</div>
                  <div className="mt-1 font-bold text-zinc-700">Approximate location: {locationLabel}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.isUnusual ? (
                    <span className="hidden rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-black uppercase text-red-900 sm:inline-flex">
                      Check this login
                    </span>
                  ) : null}
                  <ChevronDown className="mt-1 text-zinc-500 transition group-open:rotate-180" size={18} aria-hidden="true" />
                </div>
              </summary>
              <div className="border-t border-zinc-200 px-4 pb-4 pt-3">
                <div className="grid gap-1 font-bold text-zinc-700">
                  <span>Approximate location: {locationLabel}</span>
                  <span>First seen: {item.firstSeenLabel}</span>
                  <span>Sign-ins recorded: {item.signInCount}</span>
                  <span>{formatIpAddress(ipLabel)}</span>
                </div>
                {item.isUnusual ? (
                  <p className="mt-3 text-sm font-black leading-6 text-red-950">
                    This sign-in appears outside the UK. If it was not you, use Report account as hacked in the Account Centre.
                  </p>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </article>
  );
}
