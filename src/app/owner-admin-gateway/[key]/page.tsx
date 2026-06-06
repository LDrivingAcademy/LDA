import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

type OwnerAdminGatewayPageProps = {
  params: Promise<{
    key: string;
  }>;
};

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest();
}

function secretsMatch(provided: string, expected: string) {
  const providedHash = hashSecret(provided);
  const expectedHash = hashSecret(expected);

  return timingSafeEqual(providedHash, expectedHash);
}

export default async function OwnerAdminGatewayPage({ params }: OwnerAdminGatewayPageProps) {
  const { key } = await params;
  const expectedKey = process.env.LDA_ADMIN_ENTRY_KEY;

  if (!expectedKey || !secretsMatch(key, expectedKey)) {
    return (
      <main className="min-h-screen bg-black px-4 py-10 text-white">
        <section className="mx-auto max-w-3xl rounded border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
          <ShieldAlert className="text-brand" />
          <h1 className="mt-4 text-3xl font-black">Owner gateway unavailable</h1>
          <p className="mt-3 leading-7 text-zinc-400">
            This private admin gateway is locked. Use the correct owner link, and make sure the server has LDA_ADMIN_ENTRY_KEY configured.
          </p>
        </section>
      </main>
    );
  }

  const cookieStore = await cookies();
  cookieStore.set("lda_admin_gateway", "granted", {
    httpOnly: true,
    maxAge: 60 * 30,
    path: "/admin",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });

  redirect("/admin");
}
