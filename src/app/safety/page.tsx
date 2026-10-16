import Link from "next/link";
import { PageTopBar } from "@/components/page-top-bar";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Safety | L Driving Academy", description: "Account verification, safer lessons and reporting concerns for LDA learners and instructors." };

const sections = [
  { title: "Instructor identity and approval", body: "LDA's instructor application asks for an ADI registration number, ADI badge or certificate, and driving licence evidence for review. Approval and teaching setup are separate steps: instructors must also keep their vehicle, insurance and teaching information up to date. Ask to see your instructor's current badge before lessons and raise any mismatch with LDA." },
  { title: "Learner eligibility and licence details", body: "Learner setup includes date of birth, provisional licence details and account verification. Learners must provide accurate information and tell their instructor about any licence restrictions relevant to lessons. Instructors should confirm the learner's identity and entitlement before driving; an account label is not a substitute for checking current documents." },
  { title: "A suitable vehicle and a safe lesson", body: "Instructors are responsible for maintaining a roadworthy vehicle, appropriate insurance and valid teaching credentials. Agree the pickup point and lesson plan before starting. Both people should be fit to take part, wear seat belts and speak up if conditions or behaviour make a lesson unsafe. Stop safely if a concern arises." },
  { title: "Respect, boundaries and personal information", body: "Learners and instructors should be treated with respect. Harassment, discrimination, intimidation and inappropriate contact are unacceptable. Share only information needed for the lesson and use your account's document-upload process for verification evidence rather than sending it to other users." },
  { title: "Booking records and reporting concerns", body: "Keep your booking reference and relevant messages when reporting an issue. Use LDA support for concerns about an instructor, learner, vehicle, payment or account. Describe what happened and when, and avoid including unnecessary sensitive information. Support is not an emergency service." }
];

export default function SafetyPage() {
  return <><PageTopBar /><main className="min-h-screen bg-white text-black">
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm font-black uppercase text-brand">LDA safety</p>
      <h1 className="mt-4 text-3xl font-black sm:text-5xl">Safer lessons for learners and instructors.</h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-700">Clear checks, shared responsibilities and a way to raise concerns help people use LDA with confidence. Verification records support those checks; they do not guarantee that every lesson is risk-free or replace current licence and vehicle checks.</p>
      <div className="mt-8 grid gap-5">{sections.map(section => <section key={section.title} className="rounded border border-zinc-200 p-5 sm:p-6"><h2 className="text-xl font-black sm:text-2xl">{section.title}</h2><p className="mt-3 leading-7 text-zinc-700">{section.body}</p></section>)}</div>
      <section className="mt-6 rounded border border-red-200 bg-red-50 p-5"><h2 className="text-xl font-black">Need help?</h2><p className="mt-3 leading-7">If there is immediate danger or a serious emergency, call 999. For non-emergency platform concerns, contact LDA support.</p><Link href="/support?from=safety" className="mt-4 lda-pill lda-pill-sm lda-red-pill lda-home-primary-cta">Contact support</Link></section>
      <section className="mt-8"><h2 className="text-xl font-black">Official guidance and LDA policies</h2><ul className="mt-4 space-y-3 font-bold underline">
        <li><a href="https://www.gov.uk/driving-lessons-learning-to-drive/taking-driving-lessons">GOV.UK: driving lessons and eligibility</a></li>
        <li><a href="https://www.gov.uk/find-driving-schools-and-lessons">GOV.UK: find and check driving instructors</a></li>
        <li><Link href="/cancellation-policy">Cancellation and refund policy</Link></li><li><Link href="/privacy">Privacy policy</Link></li><li><Link href="/terms">Terms of use</Link></li>
      </ul></section>
    </section></main><SiteFooter /></>;
}
