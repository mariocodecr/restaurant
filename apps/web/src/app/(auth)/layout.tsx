import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
