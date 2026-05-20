"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { PARTS, type PartId } from "@/lib/types";

type Row = {
  id: string;
  part_id: PartId | null;
  name: string;
  instruction: string | null;
  active: boolean;
  sort_order: number;
};

const emptyForm = {
  part_id: "" as PartId | "",  // "" = 공통
  name: "",
  instruction: "",
  sort_order: 0,
};

export default function AdminHomecarePage() {
  const [rows, setRows] = useState<Row[]>([]);
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
      .from("homecare_master")
      .select("id, part_id, name, instruction, active, sort_order")
      .order("part_id", { nullsFirst: true })
      .order("sort_order");
    if (error) setError(error.message);
    else setRows((data as Row[]) ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(r: Row) {
    setEditingId(r.id);
    setForm({
      part_id: r.part_id ?? "",
      name: r.name,
      instruction: r.instruction ?? "",
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
    if (!form.name.trim()) {
      alert("이름은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const sb = createClient();
      const payload = {
        part_id: form.part_id || null,
        name: form.name.trim(),
        instruction: form.instruction.trim() || null,
        sort_order: Number(form.sort_order) || 0,
      };
      const { error } = editingId
        ? await sb.from("homecare_master").update(payload).eq("id", editingId)
        : await sb.from("homecare_master").insert(payload);
      if (error) throw error;
      reset();
      await load();
    } catch (err) {
      alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: Row) {
    const sb = createClient();
    const { error } = await sb.from("homecare_master").update({ active: !r.active }).eq("id", r.id);
    if (error) alert(error.message);
    else load();
  }

  // 그룹: 공통(null) + 파트별
  const common = rows.filter((r) => r.part_id == null);
  const byPart: Record<string, Row[]> = {};
  for (const r of rows) {
    if (r.part_id) (byPart[r.part_id] ||= []).push(r);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-sand-900">홈케어 마스터</h2>
        <button
          type="button"
          onClick={() => (showNew ? reset() : setShowNew(true))}
          className="rounded-lg bg-clay-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-600"
        >
          {showNew ? "닫기" : "+ 신규 홈케어"}
        </button>
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "홈케어 수정" : "신규 홈케어"}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2">
            <Field label="이름">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 두피 마사지 5분"
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="파트 (공통이면 비워두세요)">
              <select
                value={form.part_id}
                onChange={(e) => setForm({ ...form, part_id: e.target.value as PartId | "" })}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">모든 파트 공통</option>
                {PARTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="환자 안내 문구 (출력용, 선택)">
              <textarea
                value={form.instruction}
                onChange={(e) => setForm({ ...form, instruction: e.target.value })}
                placeholder="예: 매일 저녁 샴푸 전 5분간 두피를 부드럽게 마사지하세요."
                rows={3}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm md:col-span-2"
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
        <div className="py-12 text-center text-sm text-sand-500">등록된 홈케어가 없습니다.</div>
      ) : (
        <>
          {common.length > 0 && (
            <HomecareGroup title={`모든 파트 공통 (${common.length})`} items={common} onEdit={startEdit} onToggle={toggleActive} />
          )}
          {PARTS.filter((p) => byPart[p.id]?.length).map((p) => (
            <HomecareGroup
              key={p.id}
              title={`${p.label} (${byPart[p.id].length})`}
              items={byPart[p.id]}
              onEdit={startEdit}
              onToggle={toggleActive}
            />
          ))}
        </>
      )}
    </div>
  );
}

function HomecareGroup({
  title,
  items,
  onEdit,
  onToggle,
}: {
  title: string;
  items: Row[];
  onEdit: (r: Row) => void;
  onToggle: (r: Row) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="space-y-2">
          {items.map((r) => (
            <li
              key={r.id}
              className={`flex items-start gap-2 rounded-lg px-3 py-2.5 ${
                r.active ? "bg-white border border-sand-100" : "bg-sand-100 text-sand-400"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{r.name}</div>
                {r.instruction && (
                  <div className="mt-1 text-xs text-sand-500 leading-relaxed whitespace-pre-wrap">
                    {r.instruction}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => onEdit(r)} className="rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400">수정</button>
                <button onClick={() => onToggle(r)} className="rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400">
                  {r.active ? "비활성" : "활성"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
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
