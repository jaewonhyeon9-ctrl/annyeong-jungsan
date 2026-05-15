import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6 py-12">
      <header className="text-center">
        <div className="mb-3 inline-flex items-center rounded-full bg-clay-500/10 px-3 py-1 text-xs font-medium text-clay-600">
          안녕메디컬 뷰티센터
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-sand-900">정산 시스템</h1>
        <p className="mt-2 text-sm text-sand-600">
          원장님은 매출을 입력하고,
          <br />
          법인은 통합 정산을 확인합니다.
        </p>
      </header>

      <nav className="flex w-full flex-col gap-3">
        <Link
          href="/owner"
          className="group flex items-center justify-between rounded-2xl border border-sand-200 bg-white/80 px-5 py-4 shadow-sm transition hover:border-clay-400 hover:shadow"
        >
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-clay-500">
              원장
            </div>
            <div className="mt-1 text-lg font-semibold text-sand-800">오늘 매출 입력</div>
            <div className="mt-0.5 text-xs text-sand-500">차트 촬영 → 자동입력</div>
          </div>
          <span className="text-2xl text-sand-400 transition group-hover:translate-x-1 group-hover:text-clay-500">
            →
          </span>
        </Link>

        <Link
          href="/admin"
          className="group flex items-center justify-between rounded-2xl border border-sand-200 bg-white/80 px-5 py-4 shadow-sm transition hover:border-moss-500 hover:shadow"
        >
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-moss-600">
              법인 / 메인센터
            </div>
            <div className="mt-1 text-lg font-semibold text-sand-800">정산 대시보드</div>
            <div className="mt-0.5 text-xs text-sand-500">월별 통합 정산 · 50:50 분배</div>
          </div>
          <span className="text-2xl text-sand-400 transition group-hover:translate-x-1 group-hover:text-moss-500">
            →
          </span>
        </Link>
      </nav>

      <footer className="text-center text-[11px] text-sand-500">
        Phase 1 — 데모 데이터로 동작 (Supabase 연결 전)
      </footer>
    </main>
  );
}
