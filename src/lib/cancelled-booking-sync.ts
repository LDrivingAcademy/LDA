import { readStoredJsonOrNull } from "@/lib/browser-storage";

export const cancelledBookingStorageKey = "lda-cancelled-bookings";
const learnerBookingsStorageKey = "lda-learner-bookings";
const cancellationEventName = "lda-booking-cancelled";

type CancelledBookingEntry = {
  reference: string;
  refundSummary?: string;
  cancelledAt: string;
};

type CancellableRecord = {
  id?: string;
  reference?: string;
  status: string;
  refundSummary?: string;
};

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normaliseReference(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function readCancelledEntries() {
  if (!hasBrowserStorage()) return [];
  const stored = readStoredJsonOrNull<CancelledBookingEntry[]>(cancelledBookingStorageKey);
  return Array.isArray(stored) ? stored.filter((entry) => normaliseReference(entry.reference)) : [];
}

function writeCancelledEntries(entries: CancelledBookingEntry[]) {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(cancelledBookingStorageKey, JSON.stringify(entries));
}

export function getCancelledBookingMap() {
  return new Map(readCancelledEntries().map((entry) => [normaliseReference(entry.reference), entry]));
}

export function isBookingReferenceCancelled(reference: string | null | undefined) {
  const normalised = normaliseReference(reference);
  return Boolean(normalised && getCancelledBookingMap().has(normalised));
}

export function applyCancelledBookingStatus<T extends CancellableRecord>(records: T[]) {
  const cancelled = getCancelledBookingMap();

  if (!cancelled.size) {
    return records;
  }

  return records.map((record) => {
    const idEntry = cancelled.get(normaliseReference(record.id));
    const referenceEntry = cancelled.get(normaliseReference(record.reference));
    const entry = idEntry ?? referenceEntry;

    return entry
      ? {
          ...record,
          status: "cancelled",
          refundSummary: entry.refundSummary || record.refundSummary
        }
      : record;
  });
}

export function rememberCancelledBooking(reference: string, refundSummary?: string) {
  const normalised = normaliseReference(reference);
  if (!hasBrowserStorage() || !normalised) return;

  const entries = readCancelledEntries().filter((entry) => normaliseReference(entry.reference) !== normalised);
  const entry = {
    reference: normalised,
    refundSummary,
    cancelledAt: new Date().toISOString()
  };

  writeCancelledEntries([entry, ...entries].slice(0, 250));
  markStoredLearnerBookingsCancelled(normalised, refundSummary);
  window.dispatchEvent(new CustomEvent(cancellationEventName, { detail: entry }));
}

export function subscribeToCancelledBookings(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === cancelledBookingStorageKey || event.key === learnerBookingsStorageKey) {
      onChange();
    }
  };
  const handlePageShow = () => onChange();
  const handleVisibility = () => {
    if (!document.hidden) onChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(cancellationEventName, handlePageShow);
  window.addEventListener("pageshow", handlePageShow);
  window.addEventListener("focus", handlePageShow);
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(cancellationEventName, handlePageShow);
    window.removeEventListener("pageshow", handlePageShow);
    window.removeEventListener("focus", handlePageShow);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}

function markStoredLearnerBookingsCancelled(reference: string, refundSummary?: string) {
  const stored = readStoredJsonOrNull<CancellableRecord[]>(learnerBookingsStorageKey);
  if (!Array.isArray(stored)) return;

  const updated = stored.map((booking) =>
    normaliseReference(booking.id) === reference || normaliseReference(booking.reference) === reference
      ? {
          ...booking,
          status: "cancelled",
          refundSummary: refundSummary || booking.refundSummary
        }
      : booking
  );

  window.localStorage.setItem(learnerBookingsStorageKey, JSON.stringify(updated));
}
