"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { PARTS, type PartId } from "@/lib/types";

type ServiceRow = {
  id: string;
  part_id: PartId;
  name: string;
  default_price: number;
  active: boolean;
  sort_order: number;
};

const emptyForm = {
  id: "",
  part_id: "scalp" as PartId,
  name: "",
  default_price: 0,
  sort_order: 0,
};

export default function AdminServicesPage() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    const sb = createClient();
    const { data, error } = await sb
      .from("services")
      .select("id, part_id, name, default_price, active, sort_order")
      .order("part_id")
      .order("sort_order");
    if (error) setError(error.message);
    else setRows((data as ServiceRow[]) ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(r: ServiceRow) {
    setEditingId(r.id);
    setForm({
      id: r.id,
      part_id: r.part_id,
      name: r.name,
      default_price: r.default_price,
      sort_order: r.sort_order,
    });
    setShowNew(true);
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
    setShowNew(false);
  }

  async function save() {
    if (!form.id.trim() || !form.name.trim()) {
      alert("ID(코드)와 이름은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const sb = createClient();
      const payload = {
        id: form.id.trim(),
        part_id: form.part_id,
        name: form.name.trim(),
        default_price: Number(form.default_price) || 0,
        sort_order: Number(form.sort_order) || 0,
      };
      const { error } = editingId
        ? await sb.from("services").update(payload).eq("id", editingId)
        : await sb.from("services").insert(payload);
      if (error) throw error;
      reset();
      await load();
    } catch (err) {
      alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: ServiceRow) {
    const sb = createClient();
    const { error } = await sb
      .from("services")
      .update({ active: !r.active })
      .eq("id", r.id);
    if (error) alert(error.message);
    else load();
  }

  async function deleteService(r: ServiceRow) {
    const confirmed = window.confirm(
      `시술품목 "${r.name}" 을(를) 완전히 삭제하시겠습니까?\n\n` +
        `과거 방문/매출 기록에서 이 시술명은 그대로 남지만, ` +
        `목록에서는 사라져 더는 선택할 수 없게 됩니다.\n\n` +
        `잠시만 숨기려면 "비활성"을 사용하세요. 삭제는 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;
    const sb = createClient();
    const { error } = await sb.from("services").delete().eq("id", r.id);
    if (error) {
      // FK 제약(과거 visit_sale_lines가 참조)으로 실패할 가능성 → 안내
      alert(
        `삭제 실패: ${error.message}\n\n` +
          `과거 매출 기록이 이 시술을 참조하는 경우 삭제할 수 없습니다. ` +
          `이런 경우 "비활성"을 사용하세요.`
      );
      return;
    }
    load();
  }

  const partLabel = (id: PartId) => PARTS.find((p) => p.id === id)?.label ?? id;
  const byPart: Record<string, ServiceRow[]> = {};
  for (const r of rows) (byPart[r.part_id] ||= []).push(r);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-sand-900">시술 품목</h2>
        <button
          type="button"
          onClick={() => (showNew ? reset() : setShowNew(true))}
          className="rounded-lg bg-clay-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-600"
        >
          {showNew ? "닫기" : "+ 신규 시술"}
        </button>
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "시술 수정" : "신규 시술"}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2">
            <Field label="ID (코드, 영문/숫자, 예: scalp.naeseong)">
              <input
                value={form.id}
                disabled={!!editingId}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm disabled:bg-sand-100"
              />
            </Field>
            <Field label="이름">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="파트">
              <select
                value={form.part_id}
                onChange={(e) => setForm({ ...form, part_id: e.target.value as PartId })}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              >
                {PARTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="기본가 (원)">
              <input
                type="number"
                value={form.default_price}
                onChange={(e) => setForm({ ...form, default_price: Number(e.target.value) })}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm tabular"
              />
            </Field>
            <Field label="정렬순">
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm tabular"
              />
            </Field>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button onClick={reset} className="rounded-lg border border-sand-200 px-4 py-2 text-sm text-sand-700">취소</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-sand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-sand-900 disabled:opacity-60">
                {saving ? "저장 중..." : editingId ? "수정 완료" : "추가"}
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {error && <div className="rounded-xl bg-clay-500/10 px-4 py-3 text-sm text-clay-700">{error}</div>}

      {!loaded ? (
        <div className="py-6 text-center text-sm text-sand-500">로딩 중...</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-sand-500">등록된 시술이 없습니다.</div>
      ) : (
        PARTS.filter((p) => byPart[p.id]?.length).map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle>{p.label} ({byPart[p.id].length})</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="space-y-1.5">
                {byPart[p.id].map((r) => (
                  <li key={r.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${r.active ? "bg-white border border-sand-100" : "bg-sand-100 text-sand-400"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{r.name}</span>
                        <span className="text-[10px] text-sand-400">{r.id}</span>
                      </div>
                      <div className="text-xs text-sand-500">{r.default_price.toLocaleString()}원 · 정렬 {r.sort_order}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(r)} className="rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400">수정</button>
                      <button onClick={() => toggleActive(r)} className="rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400">
                        {r.active ? "비활성" : "활성"}
                      </button>
                      <button onClick={() => deleteService(r)} className="rounded border border-clay-300 px-2 py-1 text-[11px] text-clay-700 hover:bg-clay-500/10" title="완전 삭제">🗑</button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))
      )}
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
