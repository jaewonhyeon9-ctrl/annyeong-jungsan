"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtWon } from "@/lib/format";
import {
  invalidateServicesCache,
  useServicesByPart,
} from "@/lib/services";
import { PARTS, type PartId, type ServiceRecord } from "@/lib/types";
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
  const { profile, loaded: profileLoaded } = useCurrentProfile();

  // 원장은 자기 파트만 수정 가능. admin이 와도 자기 선택 파트에서 수정.
  const myPart: PartId | null = useMemo(() => {
    if (profile?.role === "owner" && profile.partId) return profile.partId;
    return null;
  }, [profile]);

  const [activePart, setActivePart] = useState<PartId>("scalp");
  useEffect(() => {
    if (myPart) setActivePart(myPart);
  }, [myPart]);

  const { services, loaded, refresh } = useServicesByPart(activePart);

  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditingId(null);
    setForm(emptyForm());
    setShowNew(false);
    setError(null);
  }

  function startNew() {
    setEditingId(null);
    setForm(emptyForm());
    setShowNew(true);
    setError(null);
  }

  function startEdit(s: ServiceRecord) {
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

  async function handleSave() {
    setError(null);
    const name = form.name.trim();
    if (!name) {
      setError("시술 이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const data = await getDataSource();
      if (editingId) {
        await data.services.update(editingId, {
          name,
          defaultPrice: Number(form.defaultPrice) || 0,
          sortOrder: Number(form.sortOrder) || 0,
        });
      } else {
        const id = form.id.trim() || autoId(name, activePart);
        await data.services.create({
          id,
          partId: activePart,
          name,
          defaultPrice: Number(form.defaultPrice) || 0,
          sortOrder: Number(form.sortOrder) || 0,
        });
      }
      invalidateServicesCache();
      await refresh();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(s: ServiceRecord) {
    try {
      const data = await getDataSource();
      await data.services.update(s.id, { active: !s.active });
      invalidateServicesCache();
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(s: ServiceRecord) {
    if (
      !window.confirm(
        `시술 "${s.name}" 을(를) 삭제할까요?\n과거 매출 기록은 그대로 남고, 앞으로는 선택 목록에서 사라집니다.`
      )
    )
      return;
    try {
      const data = await getDataSource();
      await data.services.delete(s.id);
      invalidateServicesCache();
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }

  if (!profileLoaded) {
    return <div className="py-12 text-center text-sm text-sand-500">로딩 중...</div>;
  }

  const showPartSwitcher = !myPart; // owner는 자기 파트 고정, 그 외는 파트 선택

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-sand-900">시술 품목</h2>
          <p className="mt-0.5 text-xs text-sand-500">
            등록한 시술은 모든 디바이스에서 빠른매출·방문 차트에 즉시 보입니다.
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
                disabled={saving}
                className="rounded-lg bg-sand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-900 disabled:opacity-60"
              >
                {saving ? "저장 중..." : editingId ? "수정 저장" : "등록"}
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {PARTS.find((p) => p.id === activePart)?.label ?? activePart} 시술 ({services.length})
          </CardTitle>
        </CardHeader>
        <CardBody>
          {!loaded ? (
            <div className="py-6 text-center text-xs text-sand-500">로딩 중...</div>
          ) : services.length === 0 ? (
            <div className="py-6 text-center text-xs text-sand-500">
              아직 등록된 시술이 없어요. 위 “+ 시술 등록” 으로 시작하세요.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {services.map((s) => (
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
