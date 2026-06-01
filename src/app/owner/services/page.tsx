"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { fmtWon } from "@/lib/format";
import {
  addCustomService,
  CustomService,
  getCustomServices,
  isBuiltinService,
  removeCustomService,
  SERVICES,
  updateCustomService,
} from "@/lib/services";
import { PARTS, type PartId } from "@/lib/types";
import { useCurrentProfile } from "@/lib/use-current-profile";

type FormState = {
  id: string;
  name: string;
  defaultPrice: number;
  sortOrder: number;
};

function emptyForm(): FormState {
  return { id: "", name: "", defaultPrice: 0, sortOrder: 0 };
}

function autoId(name: string, partId: PartId): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${partId}.${slug || `svc_${Date.now().toString(36)}`}`;
}

export default function OwnerServicesPage() {
  const { profile, loaded } = useCurrentProfile();
  const [tick, setTick] = useState(0); // force re-render after mutation
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  // 원장: 자기 파트만. admin/그 외: 전체 파트 (선택 가능)
  const myPart: PartId | null = useMemo(() => {
    if (profile?.role === "owner" && profile.partId) return profile.partId;
    return null;
  }, [profile]);

  const [activePart, setActivePart] = useState<PartId>("scalp");
  useEffect(() => {
    if (myPart) setActivePart(myPart);
  }, [myPart]);

  const myBuiltins = useMemo(
    () => SERVICES.filter((s) => s.partId === activePart),
    [activePart, tick]
  );

  const myCustoms = useMemo(
    () =>
      getCustomServices()
        .filter((s) => s.partId === activePart)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    // tick 변경 시 재계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activePart, tick]
  );

  function refresh() {
    setTick((n) => n + 1);
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyForm());
    setShowNew(true);
    setError(null);
  }

  function startEdit(s: CustomService) {
    setEditingId(s.id);
    setForm({
      id: s.id,
      name: s.name,
      defaultPrice: s.defaultPrice,
      sortOrder: s.sortOrder ?? 0,
    });
    setShowNew(true);
    setError(null);
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm());
    setShowNew(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    const name = form.name.trim();
    if (!name) {
      setError("시술 이름을 입력해주세요.");
      return;
    }
    const id = (form.id.trim() || autoId(name, activePart)).trim();
    const price = Number(form.defaultPrice) || 0;
    const sortOrder = Number(form.sortOrder) || 0;

    try {
      if (editingId) {
        updateCustomService(editingId, {
          name,
          defaultPrice: price,
          sortOrder,
          partId: activePart,
        });
      } else {
        addCustomService({
          id,
          partId: activePart,
          name,
          defaultPrice: price,
          sortOrder,
          createdBy: profile?.id,
        });
      }
      refresh();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleToggleActive(s: CustomService) {
    updateCustomService(s.id, { active: !s.active });
    refresh();
  }

  function handleDelete(s: CustomService) {
    if (
      !window.confirm(
        `시술 "${s.name}" 을(를) 삭제할까요?\n과거 매출 기록은 그대로 남고, 앞으로는 선택 목록에서 사라집니다.`
      )
    )
      return;
    removeCustomService(s.id);
    refresh();
  }

  if (!loaded) {
    return <div className="py-12 text-center text-sm text-sand-500">로딩 중...</div>;
  }

  const showPartSwitcher = !myPart; // admin/일반 사용자는 파트 선택 가능

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-sand-900">시술 품목</h2>
          <p className="mt-0.5 text-xs text-sand-500">
            원장이 자기 파트에서 직접 시술을 추가/수정할 수 있어요. 등록한
            시술은 빠른매출·방문 차트에 자동으로 보입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (showNew ? reset() : startNew())}
          className="rounded-lg bg-clay-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-600"
        >
          {showNew ? "닫기" : "+ 시술 등록"}
        </button>
      </div>

      {showPartSwitcher && (
        <div className="flex flex-wrap gap-2">
          {PARTS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePart(p.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                activePart === p.id
                  ? "border-clay-500 bg-clay-500/15 text-clay-700"
                  : "border-sand-200 text-sand-600 hover:border-sand-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "시술 수정" : "신규 시술 등록"}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2">
            <Field label="시술 이름 *">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 헤어라인 정밀 SMP"
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="기본가 (원)">
              <input
                type="number"
                inputMode="numeric"
                value={form.defaultPrice || ""}
                onChange={(e) =>
                  setForm({ ...form, defaultPrice: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-right text-sm tabular"
              />
            </Field>
            <Field label="정렬 순서 (낮을수록 위)">
              <input
                type="number"
                inputMode="numeric"
                value={form.sortOrder || ""}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-right text-sm tabular"
              />
            </Field>
            <Field label="ID (선택 — 비워두면 자동 생성)">
              <input
                value={form.id}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder={autoId(form.name || "새시술", activePart)}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm disabled:bg-sand-100"
              />
            </Field>
            {error && (
              <div className="md:col-span-2 rounded-lg bg-clay-500/10 px-3 py-2 text-xs text-clay-700">
                {error}
              </div>
            )}
            <div className="md:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-sand-200 px-4 py-2 text-sm text-sand-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-lg bg-sand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-900"
              >
                {editingId ? "수정 저장" : "등록"}
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 내가 등록한 시술 */}
      <Card>
        <CardHeader>
          <CardTitle>
            내가 등록한 시술 ({myCustoms.length})
          </CardTitle>
        </CardHeader>
        <CardBody>
          {myCustoms.length === 0 ? (
            <div className="py-6 text-center text-xs text-sand-500">
              아직 등록한 시술이 없어요. 위 “+ 시술 등록” 으로 시작하세요.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {myCustoms.map((s) => (
                <li
                  key={s.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    s.active
                      ? "border border-sand-100 bg-white"
                      : "bg-sand-100 text-sand-400"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-[10px] text-sand-400">{s.id}</span>
                    </div>
                    <div className="text-xs text-sand-500 tabular">
                      {fmtWon(s.defaultPrice)} · 정렬 {s.sortOrder ?? 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(s)}
                      className="rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400"
                    >
                      {s.active ? "비활성" : "활성"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      className="rounded border border-clay-300 px-2 py-1 text-[11px] text-clay-700 hover:bg-clay-500/10"
                      title="삭제"
                    >
                      🗑
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* 기본 카탈로그 (참고용) */}
      <Card>
        <CardHeader>
          <CardTitle>
            기본 카탈로그 ({myBuiltins.length}){" "}
            <span className="ml-1 text-[10px] font-normal text-sand-400">
              (회사 공통 — 수정은 본사 관리자)
            </span>
          </CardTitle>
        </CardHeader>
        <CardBody>
          {myBuiltins.length === 0 ? (
            <div className="py-4 text-center text-xs text-sand-500">
              이 파트의 기본 시술이 없어요.
            </div>
          ) : (
            <ul className="space-y-1">
              {myBuiltins.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg bg-sand-50 px-3 py-2 text-sand-600"
                >
                  <div>
                    <span className="text-sm font-medium">{s.name}</span>
                    <span className="ml-2 text-[10px] text-sand-400">{s.id}</span>
                  </div>
                  <div className="text-xs tabular">{fmtWon(s.defaultPrice)}</div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <div className="mb-1 font-medium text-sand-600">{label}</div>
      {children}
    </label>
  );
}
