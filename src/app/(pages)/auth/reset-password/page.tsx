import { ResetPasswordForm } from "@/components/auth";

export const metadata = {
  title: "Reset password | Otterpie",
  referrer: "no-referrer" as const,
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-secondary/25 via-background to-background px-4 py-12">
      <ResetPasswordForm token={token} />
    </main>
  );
}
