import { sendAdminNoticeEmail, sendInstructorComplianceReminderEmail } from "@/lib/email";
import { formatInstructorDocumentExpiry, getInstructorDocumentExpiryState } from "@/lib/instructor-document-expiry";
import {
  getInstructorFutureComplianceStatus
} from "@/lib/instructor-future-compliance";
import {
  getCurrentInstructorDocument,
  isApprovedInstructorDocumentStatus
} from "@/lib/instructor-document-versioning";
import {
  flattenInstructorVerificationRequirements,
  getInstructorVerificationRequirements
} from "@/lib/instructor-verification-requirements";
import { getAppOrigin, jsonNoStore } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InstructorProfileRow = {
  user_id: string;
  display_name: string | null;
  verification_status: string | null;
  compliance_status: string | null;
  learner_availability_paused: boolean | null;
  learner_availability_pause_reason: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type DocumentRow = {
  id: string;
  instructor_id: string;
  document_type: string;
  status: string | null;
  expires_at: string | null;
  created_at: string | null;
  renewal_reminder_sent_at: string | null;
  is_current: boolean | null;
  version_state: string | null;
};

type LessonBookingRecordRow = {
  booking_reference: string;
  starts_at: string | null;
  status: string | null;
  compliance_review_required?: boolean | null;
};

function reminderRecentlySent(value?: string | null) {
  if (!value) return false;
  const sent = new Date(value).getTime();
  if (Number.isNaN(sent)) return false;
  return Date.now() - sent < 7 * 24 * 60 * 60 * 1000;
}

function londonDateTimeToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(utcGuess);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const londonAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  const offsetMs = londonAsUtc - utcGuess.getTime();

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMs);
}

function endOfLondonDateIso(date: string) {
  return londonDateTimeToUtc(date, "23:59").toISOString();
}

function isActiveFutureBookingStatus(value?: string | null) {
  const status = String(value ?? "").toLowerCase();
  return !["cancelled", "canceled", "completed", "complete", "refunded", "failed"].some((blocked) =>
    status.includes(blocked)
  );
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonNoStore({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const [requirementSections, { data: instructors }, { data: documents }] = await Promise.all([
    getInstructorVerificationRequirements(admin),
    admin
      .from("instructor_profiles")
      .select("user_id,display_name,verification_status,compliance_status,learner_availability_paused,learner_availability_pause_reason")
      .eq("verification_status", "approved")
      .limit(1000),
    admin
      .from("instructor_documents")
      .select("id,instructor_id,document_type,status,expires_at,created_at,renewal_reminder_sent_at,is_current,version_state")
      .order("created_at", { ascending: false })
      .limit(10000)
  ]);

  const instructorRows = (instructors as InstructorProfileRow[] | null) ?? [];
  const documentRows = (documents as DocumentRow[] | null) ?? [];
  const instructorIds = instructorRows.map((instructor) => instructor.user_id).filter(Boolean);
  const { data: profiles } = instructorIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", instructorIds)
    : { data: [] };
  const profileById = new Map(((profiles as ProfileRow[] | null) ?? []).map((profile) => [profile.id, profile]));
  const documentsByInstructor = new Map<string, DocumentRow[]>();

  for (const document of documentRows) {
    documentsByInstructor.set(document.instructor_id, [...(documentsByInstructor.get(document.instructor_id) ?? []), document]);
  }

  const requiredDocuments = flattenInstructorVerificationRequirements(requirementSections).filter((document) => document.requirement === "required");
  const appOrigin = getAppOrigin();
  const checkedAt = new Date().toISOString();
  const pausedInstructorIds: string[] = [];
  const remindedDocumentIds: string[] = [];
  const flaggedBookingReferences: string[] = [];
  const emailResults: Array<{ instructorId: string; sent: boolean; error?: string }> = [];

  for (const instructor of instructorRows) {
    const instructorDocuments = documentsByInstructor.get(instructor.user_id) ?? [];
    const expired = [];
    const expiring = [];

    for (const requirement of requiredDocuments) {
      const document = getCurrentInstructorDocument(instructorDocuments, requirement.type);
      if (!document || !isApprovedInstructorDocumentStatus(document.status)) {
        continue;
      }

      const expiry = getInstructorDocumentExpiryState(document.expires_at);
      if (expiry.status === "expired") {
        expired.push({ requirement, document, expiry });
      } else if (expiry.status === "due_soon" && !reminderRecentlySent(document.renewal_reminder_sent_at)) {
        expiring.push({ requirement, document, expiry });
      }
    }

    if (expired.length) {
      const reason = `Required instructor compliance evidence expired on ${checkedAt}. Upload renewal evidence for LDA review.`;
      const { error: pauseError } = await admin
        .from("instructor_profiles")
        .update({
          compliance_status: "blocked",
          learner_availability_paused: true,
          learner_availability_pause_reason: reason,
          compliance_blocked_at: checkedAt,
          updated_at: checkedAt
        })
        .eq("user_id", instructor.user_id);

      if (!pauseError) {
        pausedInstructorIds.push(instructor.user_id);
      }
    }

    const longRangeCompliance = getInstructorFutureComplianceStatus(
      instructorDocuments,
      requiredDocuments.map((document) => document.type),
      "9999-12-31"
    );
    if (longRangeCompliance.earliestExpiryDate) {
      const cutoffIso = endOfLondonDateIso(longRangeCompliance.earliestExpiryDate);
      const { data: futureBookings, error: futureBookingsError } = await admin
        .from("lesson_booking_records")
        .select("booking_reference,starts_at,status,compliance_review_required")
        .eq("instructor_id", instructor.user_id)
        .gt("starts_at", cutoffIso)
        .limit(100);

      if (!futureBookingsError && Array.isArray(futureBookings)) {
        const bookingsToFlag = (futureBookings as LessonBookingRecordRow[])
          .filter((booking) => booking.booking_reference && isActiveFutureBookingStatus(booking.status))
          .filter((booking) => !booking.compliance_review_required);

        if (bookingsToFlag.length) {
          const reason = `Instructor compliance evidence expires on ${longRangeCompliance.earliestExpiryDate}, before this future lesson date. Admin review is required before the lesson can continue.`;
          const references = bookingsToFlag.map((booking) => booking.booking_reference);
          const { error: flagError } = await admin
            .from("lesson_booking_records")
            .update({
              compliance_review_required: true,
              compliance_review_reason: reason,
              compliance_review_flagged_at: checkedAt
            })
            .in("booking_reference", references);

          if (!flagError) {
            flaggedBookingReferences.push(...references);
            await admin.from("notifications").insert({
              user_id: instructor.user_id,
              notification_type: "instructor_future_booking_compliance_review",
              title: "Future booking needs compliance review",
              body:
                "One or more future bookings sits beyond a compliance document expiry. Upload renewal evidence so LDA can review it before the lesson date."
            });

            const adminEmail = process.env.LDA_ADMIN_EMAILS?.split(",").map((email) => email.trim()).filter(Boolean)[0] ||
              process.env.APP_SUPPORT_EMAIL ||
              "info@ldrivingacademy.co.uk";
            try {
              await sendAdminNoticeEmail({
                to: adminEmail,
                subject: "LDA future booking compliance review required",
                title: "Future booking compliance review required",
                body: [
                  `Instructor: ${profileById.get(instructor.user_id)?.full_name ?? instructor.display_name ?? instructor.user_id}`,
                  `Expiry date: ${longRangeCompliance.earliestExpiryDate}`,
                  `Booking reference${references.length === 1 ? "" : "s"}: ${references.join(", ")}`,
                  "Review the instructor renewal evidence and affected booking before the lesson date."
                ].join("\n")
              });
            } catch (error) {
              console.warn("[instructor-compliance] admin future booking notice failed", {
                instructorId: instructor.user_id,
                message: error instanceof Error ? error.message : "Unknown email error"
              });
            }
          } else {
            console.warn("[instructor-compliance] future booking flag failed", {
              instructorId: instructor.user_id,
              message: flagError.message,
              code: flagError.code
            });
          }
        }
      } else if (futureBookingsError) {
        console.warn("[instructor-compliance] future booking lookup failed", {
          instructorId: instructor.user_id,
          message: futureBookingsError.message,
          code: futureBookingsError.code
        });
      }
    }

    const documentsForEmail = [...expired, ...expiring];
    if (!documentsForEmail.length) {
      continue;
    }

    const profile = profileById.get(instructor.user_id);
    if (profile?.email) {
      try {
        await sendInstructorComplianceReminderEmail({
          to: profile.email,
          fullName: profile.full_name ?? instructor.display_name ?? "",
          documents: documentsForEmail.map((item) => ({
            label: item.requirement.label,
            expiryLabel: formatInstructorDocumentExpiry(item.document.expires_at),
            status: item.expiry.status === "expired" ? "expired" : "expiring"
          })),
          dashboardUrl: `${appOrigin}/instructor-verification?from=compliance-email`,
          idempotencyKey: `instructor-compliance:${instructor.user_id}:${checkedAt.slice(0, 10)}`
        });
        emailResults.push({ instructorId: instructor.user_id, sent: true });
      } catch (error) {
        emailResults.push({
          instructorId: instructor.user_id,
          sent: false,
          error: error instanceof Error ? error.message : "Email failed."
        });
      }
    }

    for (const item of documentsForEmail) {
      remindedDocumentIds.push(item.document.id);
    }

    await admin.from("notifications").insert({
      user_id: instructor.user_id,
      notification_type: expired.length ? "instructor_compliance_expired" : "instructor_compliance_renewal_due",
      title: expired.length ? "Compliance evidence has expired" : "Compliance evidence renewal due",
      body: expired.length
        ? "LDA has paused learner-facing bookings and Smart Match until renewal evidence is approved."
        : "Upload renewal evidence before expiry so learner-facing availability can stay open."
    });
  }

  if (remindedDocumentIds.length) {
    await admin
      .from("instructor_documents")
      .update({ renewal_reminder_sent_at: checkedAt })
      .in("id", Array.from(new Set(remindedDocumentIds)));
  }

  return jsonNoStore({
    ok: true,
    checkedAt,
    instructorsChecked: instructorRows.length,
    paused: pausedInstructorIds.length,
    futureBookingsFlagged: flaggedBookingReferences.length,
    reminders: remindedDocumentIds.length,
    emailResults
  });
}
