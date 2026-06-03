import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { get, post } from "../api.js";
import Modal from "../components/Modal.js";
import SummaryTab from "./tabs/SummaryTab.js";
import AttendanceTab from "./tabs/AttendanceTab.js";
import ReviewTab from "./tabs/ReviewTab.js";

const TABS = [["summary", "活动概要"], ["attendance", "出勤情况"], ["review", "活动复盘"]] as const;
type TabKey = (typeof TABS)[number][0];

export default function ActivityDetail() {
  const { id } = useParams(); const nav = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [tab, setTab] = useState<TabKey>("summary");
  const [cancelOpen, setCancelOpen] = useState(false); const [reason, setReason] = useState("");
  async function load() { setDetail(await get(`/api/admin/activities/${id}`)); }
  useEffect(() => { void load(); }, [id]);

  if (!detail) return <div className="py-16 text-center text-ink-weak">加载中…</div>;
  const s = detail.status;

  async function doCancel() {
    await post(`/api/admin/activities/${id}/cancel`, { reason });
    setCancelOpen(false); setReason(""); void load();
  }

  return (
    <div>
      <nav className="mb-2 flex items-center gap-1.5 text-sm text-ink-weak">
        <Link to="/activities" className="transition-colors hover:text-brand">活动管理</Link>
        <span>/</span>
        <span className="text-ink-soft">{detail.name}</span>
      </nav>

      <div className="mb-5 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <h1 className="text-xl font-bold text-ink">{detail.name}</h1>
        <div className="flex w-full gap-2 md:w-auto">
          {s === "draft" && <>
            <button className="btn-ghost" onClick={() => nav(`/activities/${id}/edit`)}>编辑</button>
            <button className="btn-primary" onClick={async () => { await post(`/api/admin/activities/${id}/publish`); void load(); }}>发布</button>
          </>}
          {s === "published" && <button className="btn-ghost" onClick={() => setCancelOpen(true)}>取消活动</button>}
        </div>
      </div>

      <div className="mb-5 flex gap-1 border-b border-line">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-base transition-colors ${tab === k ? "border-brand font-semibold text-brand" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" && <SummaryTab detail={detail} />}
      {tab === "attendance" && <AttendanceTab detail={detail} onChanged={() => void load()} />}
      {tab === "review" && <ReviewTab detail={detail} />}

      {cancelOpen && (
        <Modal title="取消活动？" onClose={() => setCancelOpen(false)}
          footer={<><button className="btn-ghost" onClick={() => setCancelOpen(false)}>返回</button><button className="btn-primary" onClick={() => void doCancel()}>确认取消</button></>}>
          <p className="text-base text-ink-soft">取消后将通知已报名的队员。可填写取消原因（选填）。</p>
          <textarea className="textarea h-24" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="取消原因，例如：场地临时不可用" />
        </Modal>
      )}
    </div>
  );
}
