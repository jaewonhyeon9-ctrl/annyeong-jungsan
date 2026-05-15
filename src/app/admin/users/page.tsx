"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import {
  PARTS,
  type Center,
  type PartId,
  type UserProfile,
  type UserRole,
} from "@/lib/types";

// 법인 admin — 각 파트별 ID/비번 발급 및 관리

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 신규 사용자 폼
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<{
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
    centerId: string;
    partId: PartId | "";
  }>({
    email: "",
    password: "",
    displayName: "",
    role: "owner",
    centerId: "",
    partId: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    try {
      const data = await getDataSource();
      const [u, c] = await Promise.all([data.users.list(), data.centers.list()]);
      setUsers(u);
      setCenters(c);
      if (c.length > 0 && !newForm.centerId) {
        setNewForm((f) => ({ ...f, centerId: c[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    if (!newForm.email || !newForm.password || !newForm.displayName) {
      alert("이메일/비번/이름은 필수입니다.");
      return;
    }
    if (newForm.role === "owner" && (!newForm.centerId || !newForm.partId)) {
      alert("원장은 센터와 파트가 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const data = await getDataSource();
      await data.users.create({
        email: newForm.email,
        password: newForm.password,
        displayName: newForm.displayName,
        role: newForm.role,
        centerId: newForm.role === "owner" ? newForm.centerId : null,
        partId: newForm.role === "owner" ? (newForm.partId as PartId) : null,
      });
      setShowNew(false);
      setNewForm({
        email: "",
        password: "",
        displayName: "",
        role: "owner",
        centerId: centers[0]?.id ?? "",
        partId: "",
      });
      await load();
    } catch (err) {
      alert(
        `사용자 생성 실패: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSaving(false);
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

  const partLabel = (id: PartId | null) =>
    id ? PARTS.find((p) => p.id === id)?.label ?? id : "전체";
  const centerLabel = (id: string | null) =>
    id ? centers.find((c) => c.id === id)?.name ?? id : "전체";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-sand-900">사용자 관리</h2>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="rounded-lg bg-clay-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-600"
        >
          {showNew ? "닫기" : "+ 신규 사용자"}
        </button>
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>신규 사용자</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2">
            <Field label="이름 (표시명)">
              <input
                value={newForm.displayName}
                onChange={(e) =>
                  setNewForm({ ...newForm, displayName: e.target.value })
                }
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </Field>
            <Field label="이메일">
              <input
                type="email"
                value={newForm.email}
                onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                placeholder="scalp@annyeong.com"
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </Field>
            <Field label="비밀번호 (초기)">
              <input
                type="text"
                value={newForm.password}
                onChange={(e) =>
                  setNewForm({ ...newForm, password: e.target.value })
                }
                placeholder="원장님께 안전한 채널로 전달"
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </Field>
            <Field label="역할">
              <select
                value={newForm.role}
                onChange={(e) =>
                  setNewForm({ ...newForm, role: e.target.value as UserRole })
                }
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              >
                <option value="owner">원장 (자기 파트만)</option>
                <option value="admin">법인 관리자 (전체)</option>
              </select>
            </Field>
            {newForm.role === "owner" && (
              <>
                <Field label="센터">
                  <select
                    value={newForm.centerId}
                    onChange={(e) =>
                      setNewForm({ ...newForm, centerId: e.target.value })
                    }
                    className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
                  >
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="파트">
                  <select
                    value={newForm.partId}
                    onChange={(e) =>
                      setNewForm({
                        ...newForm,
                        partId: e.target.value as PartId | "",
                      })
                    }
                    className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">파트 선택</option>
                    {PARTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="rounded-lg border border-sand-200 px-4 py-2 text-sm text-sand-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="rounded-lg bg-sand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-900 disabled:opacity-60"
              >
                {saving ? "생성 중..." : "생성"}
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

      <Card>
        <CardHeader>
          <CardTitle>사용자 목록 ({users.length})</CardTitle>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {!loaded ? (
            <div className="py-6 text-center text-sm text-sand-500">로딩 중...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-left text-[11px] uppercase tracking-wider text-sand-500">
                  <th className="py-2">이름</th>
                  <th className="py-2">이메일</th>
                  <th className="py-2">역할</th>
                  <th className="py-2">센터</th>
                  <th className="py-2">파트</th>
                  <th className="py-2">상태</th>
                  <th className="py-2 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-sand-100">
                    <td className="py-2 font-medium text-sand-800">
                      {u.displayName}
                    </td>
                    <td className="py-2 text-sand-600">{u.email}</td>
                    <td className="py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                          u.role === "admin"
                            ? "bg-moss-500/15 text-moss-700"
                            : "bg-clay-500/15 text-clay-700"
                        }`}
                      >
                        {u.role === "admin" ? "관리자" : "원장"}
                      </span>
                    </td>
                    <td className="py-2 text-sand-700">{centerLabel(u.centerId)}</td>
                    <td className="py-2 text-sand-700">{partLabel(u.partId)}</td>
                    <td className="py-2">
                      <span
                        className={`text-[11px] ${
                          u.active ? "text-moss-600" : "text-sand-400"
                        }`}
                      >
                        {u.active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        className="mr-1 rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400"
                      >
                        {u.active ? "비활성" : "활성"}
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword(u)}
                        className="rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400"
                      >
                        비번 리셋
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

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
