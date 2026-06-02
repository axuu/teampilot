import { useEffect, useState } from "react";
import { get, put } from "../api.js";
import Modal from "../components/Modal.js";
import Select from "../components/Select.js";
import Badge from "../components/Badge.js";
import { useToast } from "../components/Toast.js";
import { Plus, Pencil, Link as LinkIcon } from "../components/icons.js";
import { POSITIONS, MEMBER_LEVELS, MEMBER_STYLES, MEMBER_STATUSES, positionLabel, levelLabel } from "@teampilot/shared";

type Member = { id: string; name: string; jerseyNumber: string | null; primaryPosition: string; backupPosition: string | null; level: string | null; style: string | null; status: string; captainNote: string | null };
type Settings = { joinLink: string };

const statusLabel = (s: string) => (s === "active" ? "正常" : "离队");
const COLS = ["姓名", "球衣号", "主要位置", "备选位置", "水平", "风格", "状态", "队长备注"];

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
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-ink">队员管理</h1>
        <button className="btn-primary" onClick={() => setInvite(true)}><Plus size={16} /> 邀请队员</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3.5">
        <Select className="w-[160px]" ariaLabel="状态筛选" value={status} onChange={setStatus} placeholder="全部状态"
          options={[{ value: "", label: "全部状态" }, ...MEMBER_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))]} />
        <Select className="w-[160px]" ariaLabel="位置筛选" value={position} onChange={setPosition} placeholder="全部位置"
          options={[{ value: "", label: "全部位置" }, ...POSITIONS.map((p) => ({ value: p, label: positionLabel(p) }))]} />
      </div>

      <div className="table-wrap overflow-x-auto">
        <table className="table-pine min-w-[920px]">
          <thead><tr>{COLS.map((h) => <th key={h}>{h}</th>)}<th className="col-action">操作</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.name}</td>
                <td className="text-ink-soft">{m.jerseyNumber ?? "-"}</td>
                <td>{positionLabel(m.primaryPosition)}</td>
                <td>{m.backupPosition ? positionLabel(m.backupPosition) : "-"}</td>
                <td>{levelLabel(m.level) || "-"}</td>
                <td>{m.style ?? "-"}</td>
                <td><Badge tone={m.status === "active" ? "brand" : "danger"}>{statusLabel(m.status)}</Badge></td>
                <td className="max-w-[180px] truncate text-ink-soft" title={m.captainNote ?? undefined}>{m.captainNote || "-"}</td>
                <td className="col-action">
                  <button className="inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand-hover" onClick={() => setEditing(m)}>
                    <Pencil size={14} /> 编辑
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={COLS.length + 1} className="h-32 text-center text-ink-weak">暂无队员，点击右上角「邀请队员」开始</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {invite && (
        <Modal title="邀请队员入队" onClose={() => setInvite(false)}
          footer={<><button className="btn-ghost" onClick={() => setInvite(false)}>关闭</button>
            <button className="btn-primary" onClick={async () => { const s = await get<Settings>("/api/admin/settings"); await navigator.clipboard.writeText(s.joinLink); toast("已复制链接"); }}><LinkIcon size={16} /> 复制链接</button></>}>
          <p className="text-base text-ink-soft">点击“复制链接”获取邀请地址，并在飞书中发送。</p>
        </Modal>
      )}

      {editing && <EditMember m={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); toast("已保存"); }} />}
    </div>
  );
}

function EditMember({ m, onClose, onSaved }: { m: Member; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ ...m, jerseyNumber: m.jerseyNumber ?? "", backupPosition: m.backupPosition ?? "", level: m.level ?? "", style: m.style ?? "", captainNote: m.captainNote ?? "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
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
      footer={<><button className="btn-ghost" onClick={onClose}>取消</button><button className="btn-primary" onClick={() => void save()}>保存</button></>}>
      <div className="grid grid-cols-2 gap-x-3.5 gap-y-[18px]">
        <div><label className="field-label">姓名</label><input aria-label="姓名" className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="请填写" /></div>
        <div><label className="field-label">球衣号</label><input aria-label="球衣号" className="input" value={f.jerseyNumber} onChange={(e) => set("jerseyNumber", e.target.value)} placeholder="请填写" /></div>
        <div><label className="field-label">主要位置</label>
          <Select ariaLabel="主要位置" value={f.primaryPosition} onChange={(v) => set("primaryPosition", v)} options={POSITIONS.map((p) => ({ value: p, label: positionLabel(p) }))} /></div>
        <div><label className="field-label">备选位置</label>
          <Select ariaLabel="备选位置" value={f.backupPosition} onChange={(v) => set("backupPosition", v)} placeholder="请选择" options={[{ value: "", label: "请选择" }, ...POSITIONS.map((p) => ({ value: p, label: positionLabel(p) }))]} /></div>
        <div><label className="field-label">水平</label>
          <Select ariaLabel="水平" value={f.level} onChange={(v) => set("level", v)} placeholder="请选择" options={[{ value: "", label: "请选择" }, ...MEMBER_LEVELS.map((l) => ({ value: l, label: levelLabel(l) }))]} /></div>
        <div><label className="field-label">风格</label>
          <Select ariaLabel="风格" value={f.style} onChange={(v) => set("style", v)} placeholder="请选择" options={[{ value: "", label: "请选择" }, ...MEMBER_STYLES.map((s) => ({ value: s, label: s }))]} /></div>
        <div><label className="field-label">状态</label>
          <Select ariaLabel="状态" value={f.status} onChange={(v) => set("status", v)} options={MEMBER_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))} /></div>
        <div className="col-span-2" data-testid="note-field"><label className="field-label">队长备注</label><textarea aria-label="队长备注" maxLength={100} className="textarea h-20" value={f.captainNote} onChange={(e) => set("captainNote", e.target.value)} placeholder="请填写" /></div>
      </div>
    </Modal>
  );
}
