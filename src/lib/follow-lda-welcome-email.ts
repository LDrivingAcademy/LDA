import type { BrandedEmailInput } from "./email";

export function createFollowLdaWelcomeEmailContent(): BrandedEmailInput {
  return {
    subject: "Thank you for subscribing to L Driving Academy",
    preheader: "You are now signed up for LDA driving tips and exclusive offers.",
    intro:
      "Thank you for subscribing to the L Driving Academy mailing list. We will keep you updated with practical driving tips, selected LDA updates, and any exclusive offers that become available.",
    bodyHtml: `
      <div style="margin:24px 0;padding:18px 20px;border:1px solid #eeeeee;border-radius:14px;background:#fafafa;">
        <p style="margin:0 0 10px;color:#111111;font-size:15px;line-height:1.6;font-weight:800;">What you can expect</p>
        <ul style="margin:0;padding-left:20px;color:#3f3f46;font-size:15px;line-height:1.7;">
          <li>Useful learner-driver guidance and preparation tips.</li>
          <li>Selected LDA platform news and launch updates.</li>
          <li>Exclusive offers, promo codes, or package updates when available.</li>
        </ul>
      </div>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">Thank you for choosing L Driving Academy. We look forward to keeping you informed.</p>
      <p style="margin:0 0 18px;color:#252525;font-size:16px;line-height:1.65;">You can opt out at any time. If you need help with your account, bookings, payments, or lessons, use LDA support and the team will review it.</p>
    `,
    footerNote:
      "You are receiving this because you subscribed to LDA driving tips, selected updates, exclusive offers, and promo codes. You can opt out of marketing emails at any time.",
    tone: "success",
    showEyebrow: false,
    showTitle: false
  };
}
