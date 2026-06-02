import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  // useSearchParams() inside LoginForm forces a client bailout. Suspense
  // lets Next.js statically render the surrounding layout and stream the
  // form once params resolve.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
