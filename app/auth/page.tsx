import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function AuthPage() {
  return (
    <Suspense>
      <AuthShell />
    </Suspense>
  );
}
