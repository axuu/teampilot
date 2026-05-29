import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, post, put } from "../api.js";
import Modal from "../components/Modal.js";
import { useToast } from "../components/Toast.js";

type Member = { id:string; name:string; jerseyNumber:string|null; primaryPosition:string; backupPosition:string|null; level:string|null; style:string|null; status:string };

export default function ActivityForm() {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast();
  const [name,setName]=useState(""); const [type,setType]=useState(""); const [startTime,setStart]=useState("");
  const [duration,setDuration]=useState(120); const [location,setLocation]=useState(""); const [theme,setTheme]=useState(""); const [notes,setNotes]=useState("");
  const [members,setMembers]=useState<Member[]>([]); const [selected,setSelected]=useState<Set<string>>(new Set());
  const [confirm,setConfirm]=useState(false); const [err,setErr]=useState("");

  useEffect(() => {
    void get<Member[]>("/api/admin/members?status=active").then((ms)=>{ setMembers(ms); if(!id) setSelected(new Set(ms.map(m=>m.id))); });
    void get<any>("/api/admin/settings").then((s)=>{ if(!id && s?.defaultLocation) setLocation(s.defaultLocation); }).catch(()=>{});
  }, [id]);

  const payload = () => ({ name, type, startTime: startTime ? new Date(startTime).toISOString() : "", durationMinutes: duration, location, theme: theme||undefined, notes: notes||undefined, participantIds: [...selected] });
  const requiredOk = name && type && startTime && duration && location;
  const past = startTime && new Date(startTime).getTime() < Date.now();

  async function saveDraft() {
    const res = id ? await put<any>(`/api/admin/activities/${id}`, payload()) : await post<any>("/api/admin/activities", payload());
    toast("已保存草稿"); nav(`/activities/${id ?? res.id}`);
  }
  async function doPublish() {
    const res = id ? { id } : await post<any>("/api/admin/activities", payload());
    await post(`/api/admin/activities/${res.id}/publish`);
    setConfirm(false); nav(`/activities/${res.id}`);
  }
  function onPublishClick() { if(!requiredOk){ setErr("请填写所有必填项"); return; } setErr(""); setConfirm(true); }

  const toggle = (mid:string) => setSelected((p)=>{ const n=new Set(p); n.has(mid)?n.delete(mid):n.add(mid); return n; });

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-4">{id ? "编辑活动" : "创建活动"}</h1>
      <h2 className="font-semibold border-b pb-1 mb-3">活动信息</h2>
      <div className="space-y-3 text-sm">
        <div><label><span className="text-red-600">*</span> 活动名称</label><input aria-label="活动名称" className="block w-80 border rounded px-2 py-1" value={name} onChange={(e)=>setName(e.target.value)} placeholder="请填写" /></div>
        <div><label><span className="text-red-600">*</span> 活动类型</label>
          <div className="flex gap-4 mt-1">
            <label className="flex items-center gap-1"><input aria-label="类型-训练" type="radio" name="type" checked={type==="training"} onChange={()=>setType("training")} />训练</label>
            <label className="flex items-center gap-1"><input aria-label="类型-比赛" type="radio" name="type" checked={type==="match"} onChange={()=>setType("match")} />比赛</label>
          </div>
        </div>
        <div><label><span className="text-red-600">*</span> 开始时间</label><input aria-label="开始时间" type="datetime-local" className="block w-64 border rounded px-2 py-1" value={startTime} onChange={(e)=>setStart(e.target.value)} /></div>
        <div><label><span className="text-red-600">*</span> 预计时长（分钟）</label><input aria-label="预计时长" type="number" className="block w-40 border rounded px-2 py-1" value={duration} onChange={(e)=>setDuration(Number(e.target.value))} /></div>
        <div><label><span className="text-red-600">*</span> 活动地点</label><input aria-label="活动地点" className="block w-80 border rounded px-2 py-1" value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="请填写" /></div>
        <div><label>活动主题</label><textarea className="block w-full border rounded px-2 py-1 h-24" value={theme} onChange={(e)=>setTheme(e.target.value)} placeholder="请填写" /></div>
        <div><label>注意事项</label><textarea className="block w-full border rounded px-2 py-1 h-24" value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="请填写" /></div>
      </div>

      <h2 className="font-semibold border-b pb-1 mt-6 mb-3">参加人员</h2>
      <table className="w-full bg-white rounded-card border text-sm">
        <thead><tr className="text-left text-gray-500 border-b">{["选","姓名","球衣号","主要位置","备选位置","水平","风格","状态"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{members.map((m)=>(
          <tr key={m.id} className="border-b">
            <td className="p-2"><input aria-label={`参加-${m.name}`} type="checkbox" checked={selected.has(m.id)} onChange={()=>toggle(m.id)} /></td>
            <td className="p-2">{m.name}</td><td className="p-2">{m.jerseyNumber ?? "-"}</td><td className="p-2">{m.primaryPosition}</td>
            <td className="p-2">{m.backupPosition ?? "-"}</td><td className="p-2">{m.level ?? "-"}</td><td className="p-2">{m.style ?? "-"}</td><td className="p-2">正常</td>
          </tr>))}
        </tbody>
      </table>

      {err && <p className="text-red-600 text-sm mt-3">{err}</p>}
      <div className="mt-6 flex gap-2">
        <button className="border rounded px-3 py-1" onClick={()=>nav(-1)}>取消</button>
        <button className="border rounded px-3 py-1" onClick={()=>void saveDraft()}>保存草稿</button>
        <button className="bg-blue-600 text-white rounded px-3 py-1" onClick={onPublishClick}>发布</button>
      </div>

      {confirm && (
        <Modal title="是否要发布活动？" onClose={()=>setConfirm(false)}
          footer={<><button className="border rounded px-3 py-1" onClick={()=>setConfirm(false)}>取消</button><button className="bg-blue-600 text-white rounded px-3 py-1" onClick={()=>void doPublish()}>确认发布</button></>}>
          <p className="text-sm text-gray-600">发布活动后，受邀请的队员将收到飞书通知。</p>
          {past && <p className="text-sm text-orange-600">注意：开始时间早于当前时间，确认仍要发布？</p>}
        </Modal>
      )}
    </div>
  );
}
