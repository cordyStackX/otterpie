import { ForgotPasswordForm } from "@/components/auth"; 

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-secondary/25 via-background to-background">
      <ForgotPasswordForm />
    </main>
  );
}