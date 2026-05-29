import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get } from "../api.js";
import { ACTIVITY_TYPES, ACTIVITY_STATUSES } from "@teampilot/shared";

type Row = { id: string; name: string; type: string; startTime: string; location: string; status: string; attendanceSummary: string; reviewStatus: string };
const typeLabel = (t: string) => (t === "training" ? "训练" : "比赛");
const statusLabel: Record<string,string> = { draft:"草稿", published:"已发布", ended:"已结束", cancelled:"已取消" };

export default function Activities() {
  const [rows, setRows] = useState<Row[]>([]);
  const [type, setType] = useState(""); const [status, setStatus] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(); if (type) q.set("type", type); if (status) q.set("status", status);
    void get<Row[]>(`/api/admin/activities?${q}`).then(setRows);
  }, [type, status]);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">活动管理</h1>
        <Link to="/activities/new" className="bg-blue-600 text-white rounded px-3 py-1.5">创建活动</Link>
      </div>
      <div className="flex gap-3 mb-3 text-sm">
        <select className="border rounded px-2 py-1" value={type} onChange={(e)=>setType(e.target.value)}><option value="">全部类型</option>{ACTIVITY_TYPES.map(t=><option key={t} value={t}>{typeLabel(t)}</option>)}</select>
        <select className="border rounded px-2 py-1" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">全部状态</option>{ACTIVITY_STATUSES.map(s=><option key={s} value={s}>{statusLabel[s]}</option>)}</select>
      </div>
      <table className="w-full bg-white rounded-card border text-sm">
        <thead><tr className="text-left text-gray-500 border-b">{["活动名称","类型","时间","地点","状态","出勤概况","复盘状态","操作"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{rows.map((a)=>(
          <tr key={a.id} className="border-b">
            <td className="p-2">{a.name}</td><td className="p-2">{typeLabel(a.type)}</td>
            <td className="p-2">{new Date(a.startTime).toLocaleString("zh-CN")}</td><td className="p-2">{a.location}</td>
            <td className="p-2">{statusLabel[a.status]}</td><td className="p-2">{a.attendanceSummary}</td><td className="p-2">{a.reviewStatus}</td>
            <td className="p-2"><Link className="text-blue-600" to={`/activities/${a.id}`}>详情</Link></td>
          </tr>))}
        </tbody>
      </table>
    </div>
  );
}
