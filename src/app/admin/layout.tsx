import type { Metadata } from "next";

// Служебный раздел: не индексировать.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
