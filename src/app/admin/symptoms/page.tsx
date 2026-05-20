"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { PARTS, type PartId } from "@/lib/types";

type Category = "condition" | "care_experience" | "product_in_chart" | "medication" | "allergy" | "etc";

const CATEGORY_LABEL: Record<Category, string> = {
  condition: "상태/증상",
  care_experience: "관리 경험",
  product_in_chart: "사용 제품",
  medication: "복용약",
  allergy: "알러지",
  etc: "기타",
};

const CATEGORIES: Category[] = ["condition", "care_experience", "product_in_chart", "medication", "allergy", "etc"];

type Row = {
  id: string;
  part_id: PartId;
  category: Category;
  label: string;
  value: string;
  active: boolean;
  sort_order: number;
};

const emptyForm = {
  part_id: "scalp" as PartId,
  category: "condition" as Category,
  label: "",
  value: "",
  sort_order: 0,
};

export default function AdminSymptomsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [partFilter, setPartFilter] = useState<PartId>("scalp");

  async function load() {
    setError(null);
    const sb = createClient();
    const { data, error } = await sb
      .from("symptom_master")
      .select("id, part_id, category, label, value, active, sort_order")
      .order("part_id")
      .order("category")
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
    setForm({ part_id: r.part_id, category: r.category, label: r.label, value: r.value, sort_order: r.sort_order });
    setShowNew(true);
  }

  function reset() {
    setEditingId(null);
    setForm({ ...emptyForm, part_id: partFilter });
    setShowNew(false);
  }

  async function save() {
    if (!form.label.trim() || !form.value.trim()) {
      alert("라벨과 코드(value)는 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const sb = createClient();
      const payload = {
        part_id: form.part_id,
        category: form.category,
        label: form.label.trim(),
        value: form.value.trim(),
        sort_order: Number(form.sort_order) || 0,
      };
      const { error } = editingId
        ? await sb.from("symptom_master").update(payload).eq("id", editingId)
        : await sb.from("symptom_master").insert(payload);
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
    const { error } = await sb.from("symptom_master").update({ active: !r.active }).eq("id", r.id);
    if (error) alert(error.message);
    else load();
  }

  const partRows = rows.filter((r) => r.part_id === partFilter);
  const byCategory: Record<string, Row[]> = {};
  for (const r of partRows) (byCategory[r.category] ||= []).push(r);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-sand-900">증상 마스터</h2>
        <button
          type="button"
          onClick={() => (showNew ? reset() : (setForm({ ...emptyForm, part_id: partFilter }), setShowNew(true)))}
          className="rounded-lg bg-clay-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-600"
        >
          {showNew ? "닫기" : "+ 신규 항목"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PARTS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPartFilter(p.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              partFilter === p.id ? "bg-sand-800 text-white" : "bg-white border border-sand-200 text-sand-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "항목 수정" : "신규 항목"}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2">
            <Field label="파트">
              <select
                value={form.part_id}
                onChange={(e) => setForm({ ...form, part_id: e.target.value as PartId })}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              >
                {PARTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="카테고리">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="라벨 (한글 표시명)">
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="예: 비듬"
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm"
              />
            </Field>
            <Field label="value (영문 코드 — OCR 매칭용)">
              <input
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                placeholder="예: dandruff"
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm font-mono"
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
      ) : partRows.length === 0 ? (
        <div className="py-12 text-center text-sm text-sand-500">이 파트에 등록된 항목이 없습니다.</div>
      ) : (
        CATEGORIES.filter((c) => byCategory[c]?.length).map((c) => (
          <Card key={c}>
            <CardHeader>
              <CardTitle>{CATEGORY_LABEL[c]} ({byCategory[c].length})</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {byCategory[c].map((r) => (
                  <div key={r.id} className={`flex items-center gap-1 rounded-full pl-3 pr-1 py-1 ${r.active ? "bg-clay-500/10 text-clay-700" : "bg-sand-100 text-sand-400"}`}>
                    <span className="text-xs font-medium">{r.label}</span>
                    <span className="text-[10px] text-sand-400 font-mono">{r.value}</span>
                    <button onClick={() => startEdit(r)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-sand-200">수정</button>
                    <button onClick={() => toggleActive(r)} className="text-[10px] px-1.5 py-0.5 rounded hover:bg-sand-200">
                      {r.active ? "끄기" : "켜기"}
                    </button>
                  </div>
                ))}
              </div>
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
