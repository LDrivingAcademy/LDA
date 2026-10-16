"use client";

import { useEffect, useState } from "react";

type InstantConfirmationEmailProps = {
  reference: string;
  learnerEmail: string;
  learnerPhone?: string;
  learnerName: string;
  instructorName: string;
  lessonSummary: string;
};

export function InstantConfirmationEmail({
  reference,
  learnerEmail,
  learnerPhone,
  learnerName,
  instructorName,
  lessonSummary
}: InstantConfirmationEmailProps) {
  const [status, setStatus] = useState("Preparing booking reference confirmation...");

  useEffect(() => {
    const key = `lda-confirmation-email-${reference}`;

    if (window.sessionStorage.getItem(key)) {
      setStatus("Booking reference confirmation already queued for this booking.");
      return;
    }

    window.sessionStorage.setItem(key, "1");

    fetch("/api/instant-lessons/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        learnerEmail,
        learnerPhone,
        learnerName,
        instructorName,
        lessonSummary
      })
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Email request failed");
        }

        setStatus("Booking reference email has been sent or queued. A text is also sent when a phone number is available.");
      })
      .catch(() => {
        setStatus("Booking reference confirmation could not be sent yet. Your reference number is still valid.");
      });
  }, [instructorName, learnerEmail, learnerName, learnerPhone, lessonSummary, reference]);

  return <p className="mt-4 text-sm font-bold text-zinc-600">{status}</p>;
}
