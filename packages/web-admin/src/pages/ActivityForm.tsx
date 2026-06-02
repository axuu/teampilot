import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { get, post, put } from "../api.js";
import Modal from "../components/Modal.js";
import { useToast } from "../components/Toast.js";
import { positionLabel, levelLabel } from "@teampilot/shared";

type Member = { id: string; name: string; jerseyNumber: string | null; primaryPosition: string; backupPosition: string | null; level: string | null; style: string | null; status: string };

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const Req = () => <span className="text-danger">*</span>;
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-4 border-b border-line pb-2 text-lg font-semibold text-ink">{children}</h2>
);

export default function ActivityForm() {
  const { id } = useParams(); const nav = useNavigate(); const toast = useToast();
  const [name, setName] = useState(""); const [type, setType] = useState(""); const [startTime, setStart] = useState("");
  const [duration, setDuration] = useState(120); const [location, setLocation] = useState(""); const [theme, setTheme] = useState(""); const [notes, setNotes] = useState("");
  const [members, setMembers] = useState<Member[]>([]); const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false); const [err, setErr] = useState("");

  useEffect(() => {
    void get<Member[]>("/api/admin/members?status=active").then((ms) => { setMembers(ms); if (!id) setSelected(new Set(ms.map((m) => m.id))); });
    void get<any>("/api/admin/settings").then((s) => { if (!id && s?.defaultLocation) setLocation(s.defaultLocation); }).catch(() => {});
    if (id) {
      void get<any>(`/api/admin/activities/${id}`).then((a) => {
        setName(a.name); setType(a.type); setStart(toLocalInput(a.startTime));
        setDuration(a.durationMinutes); setLocation(a.location);
        setTheme(a.theme ?? ""); setNotes(a.notes ?? "");
        setSelected(new Set((a.participants ?? []).map((p: any) => p.memberId)));
      }).catch(() => {});
    }
  }, [id]);

  const payload = () => ({ name, type, startTime: startTime ? new Date(startTime).toISOString() : "", durationMinutes: duration, location, theme: theme || undefined, notes: notes || undefined, participantIds: [...selected] });
  const requiredOk = name && type && startTime && duration && location;
  const past = startTime && new Date(startTime).getTime() < Date.now();

  async function saveDraft() {
    try {
      const res = id ? await put<any>(`/api/admin/activities/${id}`, payload()) : await post<any>("/api/admin/activities", payload());
      toast("已保存草稿"); nav(`/activities/${id ?? res.id}`);
    } catch { setErr("保存失败，请重试"); }
  }
  async function doPublish() {
    try {
      const res = id ? { id } : await post<any>("/api/admin/activities", payload());
      await post(`/api/admin/activities/${res.id}/publish`);
      setConfirm(false); nav(`/activities/${res.id}`);
    } catch { setConfirm(false); setErr("发布失败，请重试"); }
  }
  function onPublishClick() { if (!requiredOk) { setErr("请填写所有必填项"); return; } setErr(""); setConfirm(true); }

  const toggle = (mid: string) => setSelected((p) => { const n = new Set(p); n.has(mid) ? n.delete(mid) : n.add(mid); return n; });
  const allSelected = members.length > 0 && members.every((m) => selected.has(m.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(members.map((m) => m.id)));

  return (
    <div className="max-w-3xl">
      <h1 className="mb-5 text-xl font-bold text-ink">{id ? "编辑活动" : "创建活动"}</h1>

      <SectionTitle>活动信息</SectionTitle>
      <div className="space-y-[18px]">
        <div><label className="field-label"><Req /> 活动名称</label><input aria-label="活动名称" className="input max-w-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="请填写" /></div>
        <div>
          <label className="field-label"><Req /> 活动类型</label>
          <div className="flex gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-base text-ink"><input aria-label="类型-训练" type="radio" name="type" className="h-4 w-4 accent-brand" checked={type === "training"} onChange={() => setType("training")} />训练</label>
            <label className="flex cursor-pointer items-center gap-2 text-base text-ink"><input aria-label="类型-比赛" type="radio" name="type" className="h-4 w-4 accent-brand" checked={type === "match"} onChange={() => setType("match")} />比赛</label>
          </div>
        </div>
        <div className="flex flex-wrap gap-3.5">
          <div className="grow-0"><label className="field-label"><Req /> 开始时间</label><input aria-label="开始时间" type="datetime-local" className="input w-64" value={startTime} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="grow-0"><label className="field-label"><Req /> 预计时长（分钟）</label><input aria-label="预计时长" type="number" className="input w-40" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
        </div>
        <div><label className="field-label"><Req /> 活动地点</label><input aria-label="活动地点" className="input max-w-sm" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="请填写" /></div>
        <div><label className="field-label">活动主题</label><textarea className="textarea h-24" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="请填写" /></div>
        <div><label className="field-label">注意事项</label><textarea className="textarea h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="请填写" /></div>
      </div>

      <div className="mt-8"><SectionTitle>参加人员</SectionTitle></div>
      <div className="table-wrap overflow-x-auto">
        <table className="table-pine min-w-[760px]">
          <thead><tr>
            <th className="w-12"><input aria-label="全选" type="checkbox" className="h-4 w-4 accent-brand" checked={allSelected} onChange={toggleAll} /></th>
            {["姓名", "球衣号", "主要位置", "备选位置", "水平", "风格", "状态"].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className={selected.has(m.id) ? "bg-brand-soft/40" : ""}>
                <td><input aria-label={`参加-${m.name}`} type="checkbox" className="h-4 w-4 accent-brand" checked={selected.has(m.id)} onChange={() => toggle(m.id)} /></td>
                <td className="font-medium">{m.name}</td>
                <td className="text-ink-soft">{m.jerseyNumber ?? "-"}</td>
                <td>{positionLabel(m.primaryPosition)}</td>
                <td>{m.backupPosition ? positionLabel(m.backupPosition) : "-"}</td>
                <td>{levelLabel(m.level) || "-"}</td>
                <td>{m.style ?? "-"}</td>
                <td>正常</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && <p className="mt-4 rounded border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">{err}</p>}
      <div className="mt-6 flex gap-2">
        <button className="btn-ghost" onClick={() => nav(-1)}>取消</button>
        <button className="btn-secondary" onClick={() => void saveDraft()}>保存草稿</button>
        <button className="btn-primary" onClick={onPublishClick}>发布</button>
      </div>

      {confirm && (
        <Modal title="是否要发布活动？" onClose={() => setConfirm(false)}
          footer={<><button className="btn-ghost" onClick={() => setConfirm(false)}>取消</button><button className="btn-primary" onClick={() => void doPublish()}>确认发布</button></>}>
          <p className="text-base text-ink-soft">发布活动后，受邀请的队员将收到飞书通知。</p>
          {past && <p className="mt-2 rounded border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">注意：开始时间早于当前时间，确认仍要发布？</p>}
        </Modal>
      )}
    </div>
  );
}
