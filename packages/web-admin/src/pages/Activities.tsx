import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api.js";
import Select from "../components/Select.js";
import Badge from "../components/Badge.js";
import { Plus, Clock, MapPin } from "../components/icons.js";
import { ACTIVITY_TYPES, ACTIVITY_STATUSES } from "@teampilot/shared";

type Row = { id: string; name: string; type: string; startTime: string; location: string; status: string; attendanceSummary: string; reviewStatus: string };
const typeLabel = (t: string) => (t === "training" ? "训练" : "比赛");
const statusLabel: Record<string, string> = { draft: "草稿", published: "已发布", ended: "已结束", cancelled: "已取消" };
const statusTone: Record<string, "brand" | "neutral" | "danger"> = { draft: "neutral", published: "brand", ended: "neutral", cancelled: "danger" };
const COLS = ["活动名称", "类型", "时间", "地点", "状态", "出勤概况", "复盘状态"];

export default function Activities() {
  const [rows, setRows] = useState<Row[]>([]);
  const [type, setType] = useState(""); const [status, setStatus] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(); if (type) q.set("type", type); if (status) q.set("status", status);
    void get<Row[]>(`/api/admin/activities?${q}`).then(setRows);
  }, [type, status]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-ink">活动管理</h1>
        <Link to="/activities/new" className="btn-primary"><Plus size={16} /> 创建活动</Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3.5">
        <Select className="w-[160px]" ariaLabel="类型筛选" value={type} onChange={setType} placeholder="全部类型"
          options={[{ value: "", label: "全部类型" }, ...ACTIVITY_TYPES.map((t) => ({ value: t, label: typeLabel(t) }))]} />
        <Select className="w-[160px]" ariaLabel="状态筛选" value={status} onChange={setStatus} placeholder="全部状态"
          options={[{ value: "", label: "全部状态" }, ...ACTIVITY_STATUSES.map((s) => ({ value: s, label: statusLabel[s] }))]} />
      </div>

      <div className="table-wrap hidden overflow-x-auto md:block">
        <table className="table-pine min-w-[940px]">
          <thead><tr>{COLS.map((h) => <th key={h}>{h}</th>)}<th className="col-action">操作</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">{a.name}</td>
                <td>{typeLabel(a.type)}</td>
                <td className="whitespace-nowrap text-ink-soft">{new Date(a.startTime).toLocaleString("zh-CN")}</td>
                <td>{a.location}</td>
                <td><Badge tone={statusTone[a.status] ?? "neutral"}>{statusLabel[a.status]}</Badge></td>
                <td className="whitespace-nowrap text-ink-soft">{a.attendanceSummary}</td>
                <td className="text-ink-soft">{a.reviewStatus}</td>
                <td className="col-action">
                  <div className="flex items-center gap-3">
                    {a.status === "draft" && (
                      <Link className="text-sm font-medium text-brand transition-colors hover:text-brand-hover" to={`/activities/${a.id}/edit`}>编辑</Link>
                    )}
                    <Link className="text-sm font-medium text-brand transition-colors hover:text-brand-hover" to={`/activities/${a.id}`}>详情</Link>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={COLS.length + 1} className="h-32 text-center text-ink-weak">暂无活动，点击右上角「创建活动」开始</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-4 md:hidden">
        {rows.map((a) => (
          <Link key={a.id} to={`/activities/${a.id}`} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-base font-semibold text-ink">{a.name}</span>
              <Badge tone="neutral">{typeLabel(a.type)}</Badge>
            </div>
            <div className="flex flex-col gap-1.5 border-b border-line pb-3 text-sm text-ink-soft">
              <span className="flex items-center gap-1.5"><Clock size={14} className="text-ink-weak" />{new Date(a.startTime).toLocaleString("zh-CN")}</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} className="text-ink-weak" />{a.location}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <Badge tone={statusTone[a.status] ?? "neutral"}>{statusLabel[a.status]}</Badge>
              <span className="text-xs text-ink-soft">{a.attendanceSummary}</span>
            </div>
          </Link>
        ))}
        {rows.length === 0 && <p className="py-8 text-center text-sm text-ink-weak">暂无活动，点击右上角「创建活动」开始</p>}
      </div>
    </div>
  );
}
