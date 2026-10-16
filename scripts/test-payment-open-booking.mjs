import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const paymentHelp = readFileSync("src/lib/learner-payment-help.ts", "utf8");
const bookingHistoryPage = readFileSync("src/app/booking-history/page.tsx", "utf8");
const bookingHistoryPanel = readFileSync("src/components/booking-history-panel.tsx", "utf8");

assert.match(
  paymentHelp,
  /\/booking-history\?from=dashboard&booking=\$\{encodeURIComponent\(reference\)\}/,
  "Payment confirmation Open booking links must carry the selected booking reference."
);

assert.match(
  bookingHistoryPage,
  /resolvedSearchParams\?\.booking/,
  "Booking history must read the selected booking reference from the URL."
);

assert.match(
  bookingHistoryPage,
  /initialOpenBookingId=\{openBookingReference\}/,
  "Booking history must pass the selected booking into the panel."
);

assert.match(
  bookingHistoryPanel,
  /initialOpenBookingId && bookings\.some\(\(booking\) => booking\.id === initialOpenBookingId\)/,
  "Booking history must prefer the selected booking as the initially-open booking."
);

assert.match(
  bookingHistoryPanel,
  /current === booking\.id \? null : booking\.id/,
  "Booking history must still allow users to toggle each booking open or closed."
);

assert.match(
  readFileSync("src/components/learner-payment-help.tsx", "utf8"),
  /Booking history <ExternalLink size=\{17\} \/>/,
  "The refund route button must be labelled Booking history."
);

assert.match(
  readFileSync("src/components/learner-payment-help.tsx", "utf8"),
  /border border-black bg-white px-5 font-black text-black/,
  "The refund route button must be an outlined button, not a solid black block."
);

console.log("Payment open booking checks passed.");
