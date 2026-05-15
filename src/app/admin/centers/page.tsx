"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { PARTS, type Center, type PartId } from "@/lib/types";

// 법인 admin — 지점(병원) 등록 / 운영 파트 설정

const ALL_PARTS: PartId[] = PARTS.map((p) => p.id);

export default function AdminCentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
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

  async function load() {
    setError(null);
    try {
      const data = await getDataSource();
      const list = await data.centers.list();
      setCenters(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
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

  const partLabel = (id: PartId) => PARTS.find((p) => p.id === id)?.label ?? id;

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
                onClick={handleCreate}
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
        <div className="grid gap-4 md:grid-cols-2">
          {centers.map((c) => (
            <Card key={c.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-bold text-sand-900">{c.name}</div>
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
