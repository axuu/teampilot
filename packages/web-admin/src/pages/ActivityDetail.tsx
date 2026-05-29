import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, post } from "../api.js";
import SummaryTab from "./tabs/SummaryTab.js";
import AttendanceTab from "./tabs/AttendanceTab.js";
import ReviewTab from "./tabs/ReviewTab.js";

export default function ActivityDetail() {
  const { id } = useParams(); const nav = useNavigate();
  const [detail,setDetail]=useState<any>(null);
  const [tab,setTab]=useState<"summary"|"attendance"|"review">("summary");
  async function load(){ setDetail(await get(`/api/admin/activities/${id}`)); }
  useEffect(()=>{ void load(); },[id]);
  if(!detail) return <div>加载中…</div>;
  const s = detail.status;
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">{detail.name}</h1>
        <div className="flex gap-2">
          {s==="draft" && <><button className="border rounded px-3 py-1" onClick={()=>nav(`/activities/${id}/edit`)}>编辑</button>
            <button className="bg-blue-600 text-white rounded px-3 py-1" onClick={async()=>{await post(`/api/admin/activities/${id}/publish`); void load();}}>发布</button></>}
          {s==="published" && <button className="border rounded px-3 py-1" onClick={async()=>{const r=prompt("取消原因")??""; await post(`/api/admin/activities/${id}/cancel`,{reason:r}); void load();}}>取消活动</button>}
        </div>
      </div>
      <div className="flex gap-4 border-b mb-4 text-sm">
        {[["summary","活动概要"],["attendance","出勤情况"],["review","活动复盘"]].map(([k,label])=>(
          <button key={k} className={`pb-2 ${tab===k?"border-b-2 border-blue-600 text-blue-600":"text-gray-500"}`} onClick={()=>setTab(k as any)}>{label}</button>
        ))}
      </div>
      {tab==="summary" && <SummaryTab detail={detail} />}
      {tab==="attendance" && <AttendanceTab detail={detail} onChanged={()=>void load()} />}
      {tab==="review" && <ReviewTab detail={detail} />}
    </div>
  );
}
