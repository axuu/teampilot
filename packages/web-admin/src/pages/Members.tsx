import { useEffect, useState } from "react";
import { get, put } from "../api.js";
import Modal from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { POSITIONS, MEMBER_LEVELS, MEMBER_STYLES, MEMBER_STATUSES, positionLabel, levelLabel } from "@teampilot/shared";

type Member = { id: string; name: string; jerseyNumber: string | null; primaryPosition: string; backupPosition: string | null; level: string | null; style: string | null; status: string; captainNote: string | null };
type Settings = { joinLink: string };

export default function Members() {
  const toast = useToast();
  const [rows, setRows] = useState<Member[]>([]);
  const [status, setStatus] = useState(""); const [position, setPosition] = useState("");
  const [invite, setInvite] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  async function load() {
    const q = new URLSearchParams(); if (status) q.set("status", status); if (position) q.set("position", position);
    setRows(await get(`/api/admin/members?${q}`));
  }
  useEffect(() => { void load(); }, [status, position]);
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">队员管理</h1>
        <button className="bg-blue-600 text-white rounded px-3 py-1.5" onClick={() => setInvite(true)}>邀请队员</button>
      </div>
      <div className="flex gap-3 mb-3 text-sm">
        <select className="border rounded px-2 py-1" value={status} onChange={(e)=>setStatus(e.target.value)}>
          <option value="">全部状态</option>{MEMBER_STATUSES.map((s)=><option key={s} value={s}>{s==="active"?"正常":"离队"}</option>)}
        </select>
        <select className="border rounded px-2 py-1" value={position} onChange={(e)=>setPosition(e.target.value)}>
          <option value="">全部位置</option>{POSITIONS.map((p)=><option key={p} value={p}>{positionLabel(p)}</option>)}
        </select>
      </div>
      <table className="w-full bg-white rounded-card border text-sm">
        <thead><tr className="text-left text-gray-500 border-b">{["姓名","球衣号","主要位置","备选位置","水平","风格","状态","队长备注","操作"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{rows.map((m)=>(
          <tr key={m.id} className="border-b">
            <td className="p-2">{m.name}</td><td className="p-2">{m.jerseyNumber ?? "-"}</td><td className="p-2">{positionLabel(m.primaryPosition)}</td>
            <td className="p-2">{m.backupPosition ? positionLabel(m.backupPosition) : "-"}</td><td className="p-2">{levelLabel(m.level) || "-"}</td><td className="p-2">{m.style ?? "-"}</td>
            <td className="p-2">{m.status==="active"?"正常":"离队"}</td>
            <td className="p-2 max-w-[160px] truncate" title={m.captainNote ?? undefined}>{m.captainNote || "-"}</td>
            <td className="p-2"><button className="text-blue-600" onClick={()=>setEditing(m)}>编辑</button></td>
          </tr>))}
        </tbody>
      </table>

      {invite && (
        <Modal title="邀请队员入队" onClose={()=>setInvite(false)}
          footer={<><button className="border rounded px-3 py-1" onClick={()=>setInvite(false)}>关闭</button>
            <button className="bg-blue-600 text-white rounded px-3 py-1" onClick={async()=>{const s = await get<Settings>("/api/admin/settings"); await navigator.clipboard.writeText(s.joinLink); toast("已复制链接");}}>复制链接</button></>}>
          <p className="text-sm text-gray-600">点击“复制链接”获取邀请地址，并在飞书中发送。</p>
        </Modal>
      )}

      {editing && <EditMember m={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null); void load(); toast("已保存");}} />}
    </div>
  );
}

function EditMember({ m, onClose, onSaved }: { m: Member; onClose: ()=>void; onSaved: ()=>void }) {
  const [f, setF] = useState({ ...m, jerseyNumber: m.jerseyNumber ?? "", backupPosition: m.backupPosition ?? "", level: m.level ?? "", style: m.style ?? "", captainNote: m.captainNote ?? "" });
  const set = (k: string, v: string) => setF((p)=>({ ...p, [k]: v }));
  async function save() {
    await put(`/api/admin/members/${m.id}`, {
      name: f.name, jerseyNumber: f.jerseyNumber || undefined, primaryPosition: f.primaryPosition,
      backupPosition: f.backupPosition || undefined, level: f.level || undefined, style: f.style || undefined,
      status: f.status, captainNote: f.captainNote || undefined,
    });
    onSaved();
  }
  return (
    <Modal title="编辑队员" onClose={onClose}
      footer={<><button className="border rounded px-3 py-1" onClick={onClose}>取消</button><button className="bg-blue-600 text-white rounded px-3 py-1" onClick={()=>void save()}>保存</button></>}>
      <div><label className="block text-sm mb-1">姓名</label><input aria-label="姓名" className="w-full border rounded px-2 py-1" value={f.name} onChange={(e)=>set("name",e.target.value)} placeholder="请填写" /></div>
      <div><label className="block text-sm mb-1">球衣号</label><input aria-label="球衣号" className="w-full border rounded px-2 py-1" value={f.jerseyNumber} onChange={(e)=>set("jerseyNumber",e.target.value)} placeholder="请填写" /></div>
      <div><label className="block text-sm mb-1">主要位置</label><select aria-label="主要位置" className="w-full border rounded px-2 py-1" value={f.primaryPosition} onChange={(e)=>set("primaryPosition",e.target.value)}>{POSITIONS.map(p=><option key={p} value={p}>{positionLabel(p)}</option>)}</select></div>
      <div><label className="block text-sm mb-1">备选位置</label><select aria-label="备选位置" className="w-full border rounded px-2 py-1" value={f.backupPosition} onChange={(e)=>set("backupPosition",e.target.value)}><option value="">请选择</option>{POSITIONS.map(p=><option key={p} value={p}>{positionLabel(p)}</option>)}</select></div>
      <div><label className="block text-sm mb-1">水平</label><select aria-label="水平" className="w-full border rounded px-2 py-1" value={f.level} onChange={(e)=>set("level",e.target.value)}><option value="">请选择</option>{MEMBER_LEVELS.map(l=><option key={l} value={l}>{levelLabel(l)}</option>)}</select></div>
      <div><label className="block text-sm mb-1">风格</label><select aria-label="风格" className="w-full border rounded px-2 py-1" value={f.style} onChange={(e)=>set("style",e.target.value)}><option value="">请选择</option>{MEMBER_STYLES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
      <div><label className="block text-sm mb-1">状态</label><select aria-label="状态" className="w-full border rounded px-2 py-1" value={f.status} onChange={(e)=>set("status",e.target.value)}>{MEMBER_STATUSES.map(s=><option key={s} value={s}>{s==="active"?"正常":"离队"}</option>)}</select></div>
      <div data-testid="note-field"><label className="block text-sm mb-1">队长备注</label><textarea aria-label="队长备注" maxLength={100} className="w-full border rounded px-2 py-1" value={f.captainNote} onChange={(e)=>set("captainNote",e.target.value)} placeholder="请填写" /></div>
    </Modal>
  );
}
