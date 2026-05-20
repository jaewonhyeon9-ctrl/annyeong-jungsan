import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { UserMenu } from "@/components/UserMenu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="admin">
    <div className="min-h-screen bg-sand-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="text-sm font-semibold text-sand-800">법인 영역</div>
          <UserMenu />
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-5 pb-2">
          <Link
            href="/admin"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-100"
          >
            정산 대시보드
          </Link>
          <Link
            href="/admin/centers"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-100"
          >
            지점 관리
          </Link>
          <Link
            href="/admin/users"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-100"
          >
            사용자 관리
          </Link>
          <Link
            href="/admin/services"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-100"
          >
            시술
          </Link>
          <Link
            href="/admin/products"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-100"
          >
            제품
          </Link>
          <Link
            href="/admin/symptoms"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-100"
          >
            증상
          </Link>
          <Link
            href="/admin/homecare"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-100"
          >
            홈케어
          </Link>
          <Link
            href="/manual"
            className="ml-auto rounded-lg px-3 py-1.5 text-xs font-medium text-sand-500 hover:bg-sand-100"
          >
            📖 매뉴얼
          </Link>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-6">{children}</div>
    </div>
    </AuthGuard>
  );
}
