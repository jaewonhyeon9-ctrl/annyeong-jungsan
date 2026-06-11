"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { getDataSource } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import type { Consultation, Patient } from "@/lib/types";
import { useCurrentCenter } from "@/lib/use-current-center";
import { useCurrentProfile } from "@/lib/use-current-profile";

export default function OwnerConsultationsPage() {
  const { centerId, loaded: centerLoaded } = useCurrentCenter();
  const { profile } = useCurrentProfile();
  const [list, setList] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patientId: "",
    patientQuery: "",
    content: "",
    nextFollowup: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!centerId) return;
    setLoading(true);
    try {
      const data = await getDataSource();
      const items = await data.consultations.listByCenter(centerId, 100);
      setList(items);
    } finally {
      setLoading(false);
    }
  }, [centerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    (async () => {
      if (!centerId) return;
      const data = await getDataSource();
      setPatients(await data.patients.list(centerId));
    })();
  }, [centerId]);

  const filteredPatients = useMemo(() => {
    const q = form.patientQuery.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter((p) => {
        const name = p.personal?.name?.toLowerCase() ?? "";
        return name.includes(q) || p.id.toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [form.patientQuery, patients]);

  async function handleSave() {
    setError(null);
    if (!form.patientId) {
      setError("환자를 선택해주세요.");
      return;
    }
    if (!form.content.trim()) {
      setError("상담 내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const data = await getDataSource();
      await data.consultations.create({
        centerId: centerId ?? "",
        patientId: form.patientId,
        partId: profile?.partId ?? null,
        ownerId: profile?.id,
        content: form.content.trim(),
        nextFollowup: form.nextFollowup || null,
      });
      setShowForm(false);
      setForm({ patientId: "", patientQuery: "", content: "", nextFollowup: "" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("이 상담 기록을 삭제할까요?")) return;
    const data = await getDataSource();
    await data.consultations.delete(id);
    await refresh();
  }

  if (!centerLoaded) return <div className="py-12 text-center text-sm text-sand-500">로딩 중...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-sand-900">상담 관리</h2>
          <p className="mt-0.5 text-xs text-sand-500">환자별 상담 이력 + 다음 약속</p>
        </div>
        <Link href="/owner" className="text-xs text-sand-500 hover:text-sand-700">← 홈</Link>
      </div>

      <button
        type="button"
        onClick={() => setShowForm(!showForm)}
        className="w-full rounded-lg bg-clay-500 px-4 py-2 text-sm font-semibold text-white hover:bg-clay-600"
      >
        {showForm ? "닫기" : "+ 신규 상담"}
      </button>

      {showForm && (
        <Card>
          <CardBody className="space-y-3">
            <label className="block text-xs">
              <div className="mb-1 font-medium text-sand-600">환자 검색</div>
              <input
                value={form.patientQuery}
                onChange={(e) => setForm({ ...form, patientQuery: e.target.value, patientId: "" })}
                placeholder="이름 또는 번호"
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
              {filteredPatients.length > 0 && (
                <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-sand-200 bg-white">
                  {filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          patientId: p.id,
                          patientQuery: p.personal?.name ?? p.id,
                        })
                      }
                      className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-sand-50 ${
                        form.patientId === p.id ? "bg-clay-500/10" : ""
                      }`}
                    >
                      <span className="font-medium">{p.personal?.name ?? "(이름 없음)"}</span>
                      <span className="ml-2 text-[10px] text-sand-500">{p.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </label>
            <label className="block text-xs">
              <div className="mb-1 font-medium text-sand-600">상담 내용</div>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={4}
                placeholder="환자가 제기한 문제, 권유한 시술/제품, 결정 사항..."
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs">
              <div className="mb-1 font-medium text-sand-600">다음 약속 (선택)</div>
              <input
                type="date"
                value={form.nextFollowup}
                onChange={(e) => setForm({ ...form, nextFollowup: e.target.value })}
                className="w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:border-clay-400 focus:outline-none"
              />
            </label>
            {error && (
              <div className="rounded-lg bg-clay-500/10 px-3 py-2 text-xs text-clay-700">{error}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
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
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>상담 이력 ({list.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="py-6 text-center text-xs text-sand-500">로딩 중...</div>
          ) : list.length === 0 ? (
            <div className="py-6 text-center text-xs text-sand-500">아직 등록된 상담이 없어요.</div>
          ) : (
            <ul className="space-y-2">
              {list.map((c) => (
                <li key={c.id} className="rounded-lg border border-sand-100 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-sand-800">
                        {c.patientName ?? "(이름 없음)"}{" "}
                        <span className="ml-1 text-[10px] text-sand-400">{c.patientId}</span>
                      </div>
                      <div className="text-[11px] text-sand-500 tabular">
                        {fmtDate(c.consultedAt.slice(0, 10))} · {c.ownerName ?? "원장 미지정"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="rounded border border-clay-300 px-2 py-1 text-[11px] text-clay-700 hover:bg-clay-500/10"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="mt-2 whitespace-pre-wrap text-xs text-sand-700">{c.content}</div>
                  {c.nextFollowup && (
                    <div className="mt-2 inline-block rounded bg-moss-500/15 px-2 py-0.5 text-[11px] font-medium text-moss-700">
                      다음 약속: {fmtDate(c.nextFollowup)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
