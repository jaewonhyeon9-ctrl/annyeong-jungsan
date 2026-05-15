"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import {
  isProfileComplete,
  PARTS,
  type Center,
  type PartId,
  type UserProfile,
} from "@/lib/types";

// 법인 admin — 지점(병원) 등록 + 파트별 원장 계정 발급

const ALL_PARTS: PartId[] = PARTS.map((p) => p.id);

export default function AdminCentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 신규 지점 폼
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<{
    name: string;
    address: string;
    phone: string;
    enabledParts: Record<PartId, boolean>;
  }>({
    name: "",
    address: "",
    phone: "",
    enabledParts: ALL_PARTS.reduce(
      (acc, p) => ({ ...acc, [p]: true }),
      {} as Record<PartId, boolean>
    ),
  });
  const [saving, setSaving] = useState(false);

  // 어느 카드에서 어느 파트 계정 생성 폼 열려있는지
  const [accountForm, setAccountForm] = useState<{
    centerId: string;
    partId: PartId;
    displayName: string;
    email: string;
    password: string;
  } | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);

  async function load() {
    setError(null);
    try {
      const data = await getDataSource();
      const [centersList, usersList] = await Promise.all([
        data.centers.list(),
        data.users.list(),
      ]);
      setCenters(centersList);
      setUsers(usersList);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateCenter() {
    if (!newForm.name.trim()) {
      alert("지점 이름은 필수입니다.");
      return;
    }
    const enabled = ALL_PARTS.filter((p) => newForm.enabledParts[p]);
    if (enabled.length === 0) {
      alert("운영 파트를 최소 1개 이상 선택하세요.");
      return;
    }
    setSaving(true);
    try {
      const data = await getDataSource();
      await data.centers.create({
        name: newForm.name.trim(),
        enabledParts: enabled,
        address: newForm.address.trim() || undefined,
        phone: newForm.phone.trim() || undefined,
      });
      setShowNew(false);
      setNewForm({
        name: "",
        address: "",
        phone: "",
        enabledParts: ALL_PARTS.reduce(
          (acc, p) => ({ ...acc, [p]: true }),
          {} as Record<PartId, boolean>
        ),
      });
      await load();
    } catch (err) {
      alert(`지점 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function togglePart(center: Center, partId: PartId) {
    const enabled = center.enabledParts.includes(partId);
    const next = enabled
      ? center.enabledParts.filter((p) => p !== partId)
      : [...center.enabledParts, partId];
    try {
      const data = await getDataSource();
      await data.centers.update(center.id, { enabledParts: next });
      await load();
    } catch (err) {
      alert(`업데이트 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function openAccountForm(centerId: string, partId: PartId) {
    setAccountForm({
      centerId,
      partId,
      displayName: "",
      email: "",
      password: "",
    });
  }

  async function handleCreateAccount() {
    if (!accountForm) return;
    if (
      !accountForm.displayName.trim() ||
      !accountForm.email.trim() ||
      !accountForm.password.trim()
    ) {
      alert("이름/이메일/비밀번호 모두 입력해주세요.");
      return;
    }
    setCreatingAccount(true);
    try {
      const data = await getDataSource();
      await data.users.create({
        email: accountForm.email.trim(),
        password: accountForm.password,
        displayName: accountForm.displayName.trim(),
        role: "owner",
        centerId: accountForm.centerId,
        partId: accountForm.partId,
      });
      setAccountForm(null);
      await load();
    } catch (err) {
      alert(`계정 생성 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreatingAccount(false);
    }
  }

  async function toggleActive(u: UserProfile) {
    try {
      const data = await getDataSource();
      await data.users.update(u.id, { active: !u.active });
      await load();
    } catch (err) {
      alert(`업데이트 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function resetPassword(u: UserProfile) {
    const pwd = prompt(`${u.displayName} 의 새 비밀번호 입력:`);
    if (!pwd) return;
    try {
      const data = await getDataSource();
      await data.users.resetPassword(u.id, pwd);
      alert("비밀번호가 재설정되었습니다.");
    } catch (err) {
      alert(`비밀번호 리셋 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const partLabel = (id: PartId) => PARTS.find((p) => p.id === id)?.label ?? id;

  function buildOnboardingMessage(
    center: Center,
    owner: UserProfile,
    partId: PartId
  ): string {
    const site =
      typeof window !== "undefined" ? window.location.origin : "(사이트 URL)";
    return `[안녕메디컬 정산앱 안내]

${owner.displayName} 원장님 안녕하세요.
${center.name} ${partLabel(partId)} 파트 정산앱 계정이 발급되었습니다.

🌐 사이트: ${site}
📧 이메일: ${owner.email}
🔑 초기 비밀번호: (별도로 안전한 채널로 전달드립니다)

[첫 로그인 후 해야 할 일]
1. 우상단 "내 정보" 클릭 → 다음 정보 입력
   - 연락처
   - 정산 계좌 (은행 / 계좌번호 / 예금주)
   - 사업자등록번호 (있는 경우)
2. 일일 매출 입력 / 환자 등록 / 방문 차트 작성은 메인 화면에서

* 정산 계좌가 입력돼야 월말 정산 입금이 가능합니다.
* 비밀번호는 첫 로그인 후 본인이 변경하시는 것을 권장합니다.

감사합니다.`;
  }

  async function copyOnboarding(center: Center, owner: UserProfile, partId: PartId) {
    const text = buildOnboardingMessage(center, owner, partId);
    try {
      await navigator.clipboard.writeText(text);
      alert("안내 문자가 클립보드에 복사되었습니다. 카톡/문자에 붙여넣어 전송하세요.");
    } catch {
      // fallback: prompt
      prompt("안내 문자 (수동 복사):", text);
    }
  }

  // 센터 × 파트 → 원장 매핑
  const ownerByCenterPart = useMemo(() => {
    const m = new Map<string, UserProfile>();
    for (const u of users) {
      if (u.role === "owner" && u.centerId && u.partId) {
        m.set(`${u.centerId}|${u.partId}`, u);
      }
    }
    return m;
  }, [users]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-sand-900">지점 (병원) 관리</h2>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="rounded-lg bg-clay-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-600"
        >
          {showNew ? "닫기" : "+ 신규 지점"}
        </button>
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>신규 지점</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <Field label="지점 이름 (병원명)">
              <input
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="안녕메디컬 강남점"
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="주소">
                <input
                  value={newForm.address}
                  onChange={(e) =>
                    setNewForm({ ...newForm, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
                />
              </Field>
              <Field label="연락처">
                <input
                  value={newForm.phone}
                  onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                  placeholder="02-0000-0000"
                  className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
                />
              </Field>
            </div>
            <Field label="운영 파트 (이 지점에서 운영하는 파트만 체크)">
              <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
                {PARTS.map((p) => {
                  const on = newForm.enabledParts[p.id];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setNewForm({
                          ...newForm,
                          enabledParts: {
                            ...newForm.enabledParts,
                            [p.id]: !on,
                          },
                        })
                      }
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        on
                          ? "border-clay-500 bg-clay-500/10 text-clay-700"
                          : "border-sand-200 bg-white text-sand-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="rounded-lg border border-sand-200 px-4 py-2 text-sm text-sand-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreateCenter}
                disabled={saving}
                className="rounded-lg bg-sand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-900 disabled:opacity-60"
              >
                {saving ? "생성 중..." : "지점 생성"}
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {error && (
        <div className="rounded-xl bg-clay-500/10 px-4 py-3 text-sm text-clay-700">
          {error}
        </div>
      )}

      {!loaded ? (
        <Card>
          <CardBody>
            <div className="py-6 text-center text-sm text-sand-500">로딩 중...</div>
          </CardBody>
        </Card>
      ) : centers.length === 0 ? (
        <Card>
          <CardBody>
            <div className="py-8 text-center text-sm text-sand-500">
              아직 지점이 없습니다. 우상단 <strong>+ 신규 지점</strong>으로 등록.
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {centers.map((c) => (
            <Card key={c.id}>
              <CardBody>
                {/* 지점 헤더 */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-bold text-sand-900">
                      {c.name}
                    </div>
                    {c.address && (
                      <div className="mt-0.5 text-xs text-sand-500">
                        {c.address}
                      </div>
                    )}
                    {c.phone && (
                      <div className="text-xs text-sand-500">{c.phone}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-sand-500">
                      개설일
                    </div>
                    <div className="text-xs text-sand-600">
                      {fmtDate(c.createdAt)}
                    </div>
                  </div>
                </div>

                {/* 운영 파트 토글 */}
                <div className="mt-4 border-t border-sand-200 pt-3">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-sand-500">
                    운영 파트 (클릭으로 토글)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PARTS.map((p) => {
                      const on = c.enabledParts.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePart(c, p.id)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                            on
                              ? "border-clay-500 bg-clay-500/10 text-clay-700"
                              : "border-sand-200 bg-sand-100 text-sand-500"
                          }`}
                        >
                          {partLabel(p.id)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 파트별 원장 계정 */}
                <div className="mt-4 border-t border-sand-200 pt-3">
                  <div className="mb-2 text-[10px] uppercase tracking-wider text-sand-500">
                    파트별 원장 계정
                  </div>
                  <div className="space-y-2">
                    {c.enabledParts.length === 0 ? (
                      <div className="py-2 text-xs text-sand-500">
                        운영 파트를 먼저 선택하세요.
                      </div>
                    ) : (
                      c.enabledParts.map((partId) => {
                        const owner = ownerByCenterPart.get(`${c.id}|${partId}`);
                        const formOpen =
                          accountForm?.centerId === c.id &&
                          accountForm?.partId === partId;

                        return (
                          <div key={partId}>
                            <div className="flex items-center justify-between gap-2 rounded-lg bg-sand-100/60 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-clay-500/15 px-2 py-0.5 text-[10px] font-medium text-clay-700">
                                  {partLabel(partId)}
                                </span>
                                {owner ? (
                                  <div className="text-xs">
                                    <span className="font-medium text-sand-800">
                                      {owner.displayName}
                                    </span>
                                    <span className="ml-1 text-sand-500">
                                      ({owner.email})
                                    </span>
                                    {!owner.active && (
                                      <span className="ml-1 rounded bg-sand-300 px-1 text-[9px] text-sand-700">
                                        비활성
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-sand-500">
                                    계정 없음
                                  </span>
                                )}
                              </div>
                              {owner ? (
                                <div className="flex items-center gap-1">
                                  {isProfileComplete(owner) ? (
                                    <span
                                      className="rounded bg-moss-500/15 px-2 py-0.5 text-[9px] font-medium text-moss-700"
                                      title="연락처/정산 계좌 모두 입력됨"
                                    >
                                      ✓ 완성
                                    </span>
                                  ) : (
                                    <span
                                      className="rounded bg-clay-500/15 px-2 py-0.5 text-[9px] font-medium text-clay-700"
                                      title="원장님이 본인 정보 입력 필요"
                                    >
                                      ⚠️ 미완성
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => copyOnboarding(c, owner, partId)}
                                    className="rounded border border-sand-200 bg-white px-2 py-1 text-[10px] hover:border-clay-400"
                                    title="원장님께 보낼 안내 문자"
                                  >
                                    📋 안내문자
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleActive(owner)}
                                    className="rounded border border-sand-200 bg-white px-2 py-1 text-[10px] hover:border-sand-400"
                                  >
                                    {owner.active ? "비활성" : "활성"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => resetPassword(owner)}
                                    className="rounded border border-sand-200 bg-white px-2 py-1 text-[10px] hover:border-sand-400"
                                  >
                                    비번 리셋
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openAccountForm(c.id, partId)}
                                  className="rounded bg-clay-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-clay-600"
                                >
                                  + 계정 생성
                                </button>
                              )}
                            </div>

                            {/* 인라인 계정 생성 폼 */}
                            {formOpen && accountForm && (
                              <div className="mt-2 space-y-2 rounded-lg border border-clay-300 bg-clay-500/5 p-3">
                                <div className="text-xs font-semibold text-clay-700">
                                  {partLabel(partId)} 원장 계정 생성
                                </div>
                                <div className="grid gap-2 md:grid-cols-3">
                                  <input
                                    placeholder="이름 (표시명)"
                                    value={accountForm.displayName}
                                    onChange={(e) =>
                                      setAccountForm({
                                        ...accountForm,
                                        displayName: e.target.value,
                                      })
                                    }
                                    className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-xs focus:border-clay-400 focus:outline-none"
                                  />
                                  <input
                                    type="email"
                                    placeholder={`${partId}@annyeong.com`}
                                    value={accountForm.email}
                                    onChange={(e) =>
                                      setAccountForm({
                                        ...accountForm,
                                        email: e.target.value,
                                      })
                                    }
                                    className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-xs focus:border-clay-400 focus:outline-none"
                                  />
                                  <input
                                    type="text"
                                    placeholder="초기 비밀번호"
                                    value={accountForm.password}
                                    onChange={(e) =>
                                      setAccountForm({
                                        ...accountForm,
                                        password: e.target.value,
                                      })
                                    }
                                    className="rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-xs focus:border-clay-400 focus:outline-none"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setAccountForm(null)}
                                    className="rounded border border-sand-200 px-3 py-1 text-[11px] text-sand-600"
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCreateAccount}
                                    disabled={creatingAccount}
                                    className="rounded bg-sand-800 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sand-900 disabled:opacity-60"
                                  >
                                    {creatingAccount ? "생성 중..." : "생성"}
                                  </button>
                                </div>
                                <p className="text-[10px] text-sand-500">
                                  생성된 이메일/비번을 원장님께 안전한 채널로
                                  전달하세요. 처음 로그인 후 비번 변경 안내 권장.
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Link
        href="/admin"
        className="inline-block text-xs text-sand-500 hover:text-sand-700"
      >
        ← 정산 대시보드로
      </Link>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <div className="mb-1 font-medium text-sand-600">{label}</div>
      {children}
    </label>
  );
}
