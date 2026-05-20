"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

type ProductRow = {
  id: string;
  name: string;
  default_price: number;
  kind: "sale" | "consumable" | "both";
  active: boolean;
};

const KIND_LABEL: Record<ProductRow["kind"], string> = {
  sale: "판매",
  consumable: "시술 사용",
  both: "판매 + 사용",
};

const KIND_BADGE: Record<ProductRow["kind"], string> = {
  sale: "bg-clay-500/15 text-clay-700",
  consumable: "bg-moss-500/15 text-moss-700",
  both: "bg-sand-800 text-white",
};

const emptyForm = {
  id: "",
  name: "",
  default_price: 0,
  kind: "sale" as ProductRow["kind"],
};

export default function AdminProductsPage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<ProductRow["kind"] | "all">("all");

  async function load() {
    setError(null);
    const sb = createClient();
    const { data, error } = await sb
      .from("products")
      .select("id, name, default_price, kind, active")
      .order("kind")
      .order("name");
    if (error) setError(error.message);
    else setRows((data as ProductRow[]) ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(r: ProductRow) {
    setEditingId(r.id);
    setForm({ id: r.id, name: r.name, default_price: r.default_price, kind: r.kind });
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
        name: form.name.trim(),
        default_price: Number(form.default_price) || 0,
        kind: form.kind,
      };
      const { error } = editingId
        ? await sb.from("products").update(payload).eq("id", editingId)
        : await sb.from("products").insert(payload);
      if (error) throw error;
      reset();
      await load();
    } catch (err) {
      alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(r: ProductRow) {
    const sb = createClient();
    const { error } = await sb.from("products").update({ active: !r.active }).eq("id", r.id);
    if (error) alert(error.message);
    else load();
  }

  const filtered = filter === "all" ? rows : rows.filter((r) => r.kind === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-sand-900">제품 카탈로그</h2>
        <button
          type="button"
          onClick={() => (showNew ? reset() : setShowNew(true))}
          className="rounded-lg bg-clay-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-clay-600"
        >
          {showNew ? "닫기" : "+ 신규 제품"}
        </button>
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "제품 수정" : "신규 제품"}</CardTitle>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2">
            <Field label="ID (코드, 영문/숫자)">
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
            <Field label="구분">
              <div className="grid grid-cols-3 gap-2">
                {(["sale", "consumable", "both"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm({ ...form, kind: k })}
                    className={`rounded-lg border-2 py-2 text-xs font-semibold ${
                      form.kind === k
                        ? "border-clay-500 bg-clay-500 text-white"
                        : "border-sand-200 bg-white text-sand-600"
                    }`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="기본가 (원)">
              <input
                type="number"
                value={form.default_price}
                onChange={(e) => setForm({ ...form, default_price: Number(e.target.value) })}
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

      <div className="flex gap-2">
        {(["all", "sale", "consumable", "both"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === k ? "bg-sand-800 text-white" : "bg-white border border-sand-200 text-sand-600"
            }`}
          >
            {k === "all" ? "전체" : KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-clay-500/10 px-4 py-3 text-sm text-clay-700">{error}</div>}

      {!loaded ? (
        <div className="py-6 text-center text-sm text-sand-500">로딩 중...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-sand-500">등록된 제품이 없습니다.</div>
      ) : (
        <Card>
          <CardBody>
            <ul className="space-y-1.5">
              {filtered.map((r) => (
                <li key={r.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${r.active ? "bg-white border border-sand-100" : "bg-sand-100 text-sand-400"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{r.name}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${KIND_BADGE[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                      <span className="text-[10px] text-sand-400">{r.id}</span>
                    </div>
                    <div className="text-xs text-sand-500">{r.default_price.toLocaleString()}원</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(r)} className="rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400">수정</button>
                    <button onClick={() => toggleActive(r)} className="rounded border border-sand-200 px-2 py-1 text-[11px] hover:border-sand-400">
                      {r.active ? "비활성" : "활성"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
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
