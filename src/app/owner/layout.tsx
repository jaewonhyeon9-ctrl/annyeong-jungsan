import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { UserMenu } from "@/components/UserMenu";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="owner">
    <div className="min-h-screen bg-sand-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <Link href="/owner" className="text-sm font-semibold text-sand-800">
            원장 영역
          </Link>
          <UserMenu />
        </div>
      </header>
      <div className="mx-auto max-w-md px-5 py-6">{children}</div>
    </div>
    </AuthGuard>
  );
}
