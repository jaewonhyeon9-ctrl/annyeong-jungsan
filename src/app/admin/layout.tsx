import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sand-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link href="/" className="text-sand-600 hover:text-sand-800">
            ←
          </Link>
          <div className="text-sm font-semibold text-sand-800">법인 정산 대시보드</div>
          <div className="w-4" />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-6">{children}</div>
    </div>
  );
}
