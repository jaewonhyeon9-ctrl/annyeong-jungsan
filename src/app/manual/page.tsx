"use client";

import Link from "next/link";

// 사용 매뉴얼 — 법인 메인 사용자 가이드
// /manual 로 진입, 인증 불필요 (공개)
// 우상단 'PDF로 저장' 버튼 → window.print() (브라우저 인쇄 → PDF로 저장 가능)

export default function ManualPage() {
  return (
    <div className="min-h-screen bg-sand-50 text-ink">
      {/* 화면용 헤더 (인쇄 시 숨김) */}
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-sand-50/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/" className="text-sm font-semibold text-sand-700 hover:text-sand-900">
            ← BeautyChain
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-sand-800 px-4 py-2 text-xs font-semibold text-white hover:bg-sand-900"
          >
            📄 PDF로 저장 / 인쇄
          </button>
        </div>
      </header>

      <article className="mx-auto max-w-3xl space-y-8 px-6 py-10 print:py-4">
        <hgroup>
          <div className="text-xs font-semibold uppercase tracking-widest text-clay-600">
            BeautyChain
          </div>
          <h1 className="mt-2 text-3xl font-bold text-sand-900">사용 매뉴얼</h1>
          <p className="mt-1 text-sm text-sand-600">
            법인 메인 사용자 가이드 · 다중 지점 뷰티/메디컬 센터 정산 SaaS
          </p>
        </hgroup>

        <Section n={1} title="첫 로그인">
          <ul className="ml-4 list-disc space-y-1.5 text-sm">
            <li>
              사이트 주소:{" "}
              <code className="rounded bg-sand-100 px-1.5 py-0.5 text-xs">
                https://annyeong-jungsan.vercel.app
              </code>
            </li>
            <li>이메일: 발급받은 이메일</li>
            <li>비밀번호: 별도 안내된 임시 비밀번호 (첫 로그인 후 변경 권장)</li>
            <li>
              로그인하면 자동으로 <Strong>법인 정산 대시보드(/admin)</Strong> 로 이동합니다.
            </li>
          </ul>
        </Section>

        <Section n={2} title="지점(병원) 등록 — 최초 1회">
          <p className="text-sm">
            상단 메뉴 <Strong>지점 관리</Strong> 클릭 → 우상단{" "}
            <Strong>+ 신규 지점</Strong>
          </p>
          <Table
            headers={["입력 항목", "설명"]}
            rows={[
              ["지점 이름", '예: "강남점", "본점"'],
              ["주소", "선택"],
              ["연락처", "선택"],
              [
                "운영 파트",
                "5개 중 이 지점에서 운영하는 것만 체크 (두피/반영구/SMP/패디큐어/피부관리)",
              ],
            ]}
          />
          <p className="text-xs text-sand-500">
            운영 파트는 나중에 클릭으로 자유롭게 토글 가능합니다.
          </p>
        </Section>

        <Section n={3} title="원장 계정 발급 — 두 가지 방식">
          <Subsection title="A. 법인이 직접 발급">
            <ol className="ml-4 list-decimal space-y-1.5 text-sm">
              <li>
                지점 카드 안 <Strong>파트별 원장 계정</Strong> 영역에서 + 계정
                생성 클릭
              </li>
              <li>이름 / 이메일 / 초기 비밀번호 입력 → 생성</li>
              <li>
                <Strong>📋 안내문자</Strong> 클릭 → 클립보드 복사 → 카톡으로
                원장님께 전송
              </li>
            </ol>
            <Note>비밀번호는 안전한 별도 채널로 전달하세요.</Note>
          </Subsection>

          <Subsection title="B. 원장 셀프 가입 → 법인 승인">
            <ol className="ml-4 list-decimal space-y-1.5 text-sm">
              <li>
                원장이 <code className="rounded bg-sand-100 px-1.5 py-0.5 text-xs">/signup</code>{" "}
                에서 직접 가입 신청
              </li>
              <li>
                가입 시 <Strong>승인 대기</Strong> 상태 (로그인 못 함)
              </li>
              <li>
                법인 대시보드 상단에{" "}
                <Strong>⏳ 신규 가입 N명 승인 대기</Strong> 알림 표시
              </li>
              <li>
                알림 클릭 → 지점 관리 → 해당 원장의{" "}
                <Strong>✓ 승인하기</Strong> 클릭
              </li>
              <li>원장에게 "로그인 가능" 안내</li>
            </ol>
          </Subsection>
        </Section>

        <Section n={4} title="정산 대시보드 — 매일 보는 화면">
          <p className="text-sm">
            상단 메뉴 <Strong>정산 대시보드</Strong>:
          </p>
          <Table
            headers={["카드/섹션", "의미"]}
            rows={[
              ["환자 통계 4개", "총 환자 / 이번 달 신규 / 재방문 / 평균 객단가"],
              ["6개월 매출 트렌드", "월별 매출 비교 막대 차트"],
              [
                "정산 결과",
                "총매출 → 부가세·카드수수료 차감 → 순매출 50:50 분배",
              ],
              ["일자별 매출 추이", "이번 달 일자별 막대"],
              ["파트별 비중", "도넛 차트"],
              ["파트별 매출 표", "현금/카드/합계/과세여부"],
              ["환자 유입", "10개 채널별 카운트"],
              ["일자별 매출", "일자별 카드 리스트"],
            ]}
          />
          <ul className="ml-4 list-disc space-y-1 text-sm">
            <li>
              <Strong>센터 선택</Strong>: 좌상단 드롭다운으로 지점 변경
            </li>
            <li>
              <Strong>월 선택</Strong>: 그 옆 month picker로 과거 월 조회
            </li>
          </ul>
        </Section>

        <Section n={5} title="정산 룰 조정">
          <p className="text-sm">
            정산 결과 카드 안 <Strong>⚙️ 정산 룰 조정</Strong> 클릭:
          </p>
          <Table
            headers={["설정", "기본값", "의미"]}
            rows={[
              ["부가세율", "10%", "과세 매출 × 10/110 차감"],
              ["카드 수수료율", "2.5%", "카드 매출 × 0.025 차감"],
              ["센터 비율", "50%", "순매출 중 센터 몫"],
              ["법인 비율", "50%", "자동 계산 (1 - 센터)"],
              [
                "면세 파트",
                "(없음)",
                "부가세 차감 제외할 파트 토글 (의료행위면 면세)",
              ],
            ]}
          />
          <p className="text-xs text-sand-500">
            변경 즉시 정산 결과에 반영되고 자동 저장됩니다. 센터별로 다른 룰
            설정 가능.
          </p>
        </Section>

        <Section n={6} title="엑셀 다운로드">
          <p className="text-sm">
            정산 대시보드 우상단 <Strong>📊 엑셀 다운로드</Strong> 클릭:
          </p>
          <ul className="ml-4 list-disc space-y-1.5 text-sm">
            <li>
              <Strong>정산 요약</Strong> — 한 페이지 핵심 (사장님께 보내기용)
            </li>
            <li>
              <Strong>파트별 매출</Strong> — 일자×파트×결제수단 매트릭스 + 합계
            </li>
            <li>
              <Strong>환자 유입</Strong> — 10채널 카운트
            </li>
          </ul>
          <p className="text-xs text-sand-500">
            파일명:{" "}
            <code className="rounded bg-sand-100 px-1.5 py-0.5 text-xs">
              {"{지점명}_{연월}_정산.xlsx"}
            </code>
          </p>
        </Section>

        <Section n={7} title="사용자 관리 (선택)">
          <p className="text-sm">
            상단 메뉴 <Strong>사용자 관리</Strong>:
          </p>
          <ul className="ml-4 list-disc space-y-1.5 text-sm">
            <li>모든 사용자 통합 목록 (지점·파트별)</li>
            <li>신규 사용자 생성 (지점 관리에서도 가능)</li>
            <li>비활성화 / 활성화 — 일시 정지</li>
            <li>비번 리셋 — 원장이 비번 잊었을 때</li>
          </ul>
        </Section>

        <Section n={8} title="모바일 사용 (PWA)">
          <p className="text-sm">
            휴대폰에서 사이트 접속 → 브라우저 메뉴{" "}
            <Strong>홈 화면에 추가</Strong> → 앱 아이콘처럼 사용 가능.
          </p>
          <p className="text-sm">
            원장님들도 동일하게 폰에 설치하면 매출 입력 / 차트 작성 동선이
            편해집니다.
          </p>
        </Section>

        <Section n={9} title="자주 묻는 질문">
          <Faq
            q="데이터는 어디 저장되나요?"
            a="현재 버전은 각 브라우저의 localStorage에 저장됩니다. 브라우저 캐시 삭제 시 데이터도 삭제됩니다. (다음 단계: 클라우드 DB 연결 예정)"
          />
          <Faq
            q="정산 계좌가 비어있다고 떠요."
            a="원장님 본인이 /owner/profile 에서 입력해야 합니다. 안내 문자 기능으로 요청하세요."
          />
          <Faq
            q="원장이 다른 파트 데이터를 볼 수 있나요?"
            a="아니요. 원장 계정은 자기 파트 매출/방문 차트만 보입니다. 법인 admin만 전체 봅니다."
          />
          <Faq
            q="환자 개인정보도 정산 DB에 저장되나요?"
            a="의료법 안전 모드 — 정산 데이터엔 환자번호(예: C1-2605-0001)만 저장. 환자명/연락처는 원장(지점) 영역에만 보관."
          />
          <Faq
            q="비밀번호를 잊었어요."
            a="법인 메인은 다른 admin에게 리셋 요청. 원장은 법인 admin에게 요청."
          />
        </Section>

        <hr className="border-sand-200" />

        <footer className="text-center text-xs text-sand-500">
          <div>BeautyChain · 다중 지점 뷰티/메디컬 정산 SaaS</div>
          <div className="mt-1">
            발행:{" "}
            {new Date().toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
            })}
          </div>
        </footer>
      </article>

      {/* 인쇄용 스타일 */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          h1, h2, h3 { page-break-after: avoid; }
          section { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

// ───── 컴포넌트 ─────

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-sand-200 pb-6 last:border-b-0">
      <h2 className="text-xl font-bold text-sand-900">
        <span className="mr-2 inline-block rounded-full bg-clay-500 px-2.5 py-0.5 text-sm text-white">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-sand-800">{children}</div>
    </section>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-sand-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-bold text-clay-700">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-sand-900">{children}</strong>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-clay-500/10 px-3 py-2 text-xs text-clay-700">
      💡 {children}
    </p>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-sand-300 bg-sand-100 text-left text-xs uppercase tracking-wider text-sand-600">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-sand-200">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-sand-800">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-lg bg-sand-100/60 px-4 py-3">
      <div className="text-sm font-semibold text-sand-900">Q. {q}</div>
      <div className="mt-1 text-sm text-sand-700">A. {a}</div>
    </div>
  );
}
