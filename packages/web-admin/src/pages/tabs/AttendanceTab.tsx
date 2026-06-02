import { post } from "../../api.js";
import Badge from "../../components/Badge.js";
import { useToast } from "../../components/Toast.js";
import { positionLabel, levelLabel } from "@teampilot/shared";

type P = { memberId: string; attendanceResponse: string; actualAttendance: string | null; member: { name: string; jerseyNumber: string | null; primaryPosition: string; backupPosition: string | null; level: string | null; style: string | null; status: string; captainNote: string | null } };
type Detail = { id: string; status: string; participants: P[] };

const resp: Record<string, { label: string; tone: "brand" | "neutral" | "danger" }> = {
  going: { label: "去", tone: "brand" }, not_going: { label: "不去", tone: "danger" }, no_response: { label: "未反馈", tone: "neutral" },
};
const act: Record<string, { label: string; tone: "brand" | "neutral" | "danger" }> = {
  present: { label: "已到场", tone: "brand" }, absent: { label: "未到场", tone: "danger" }, pending: { label: "待确认", tone: "neutral" },
};
const COLS = ["姓名", "活动前反馈", "实际到场", "状态", "号码", "擅长位置", "备选位置", "水平", "风格", "队长备注"];

export default function AttendanceTab({ detail, onChanged }: { detail: Detail; onChanged: () => void }) {
  const toast = useToast();
  const ended = detail.status === "ended";
  async function mark(memberId: string, value: "present" | "absent") {
    try {
      await post(`/api/admin/activities/${detail.id}/participants/${memberId}/attendance`, { value });
      onChanged();
    } catch {
      toast("标记失败，请重试");
    }
  }
  return (
    <div className="table-wrap overflow-x-auto">
      <table className="table-pine min-w-[1040px]">
        <thead><tr>{COLS.map((h) => <th key={h}>{h}</th>)}<th className="col-action">操作</th></tr></thead>
        <tbody>
          {detail.participants.map((p) => (
            <tr key={p.memberId}>
              <td className="font-medium">{p.member.name}</td>
              <td><Badge tone={resp[p.attendanceResponse]?.tone ?? "neutral"}>{resp[p.attendanceResponse]?.label ?? p.attendanceResponse}</Badge></td>
              <td>{p.actualAttendance ? <Badge tone={act[p.actualAttendance]?.tone ?? "neutral"}>{act[p.actualAttendance]?.label ?? p.actualAttendance}</Badge> : <span className="text-ink-weak">—</span>}</td>
              <td><Badge tone={p.member.status === "active" ? "brand" : "danger"}>{p.member.status === "active" ? "正常" : "离队"}</Badge></td>
              <td className="text-ink-soft">{p.member.jerseyNumber ?? "-"}</td>
              <td>{positionLabel(p.member.primaryPosition)}</td>
              <td>{p.member.backupPosition ? positionLabel(p.member.backupPosition) : "-"}</td>
              <td>{levelLabel(p.member.level) || "-"}</td>
              <td>{p.member.style ?? "-"}</td>
              <td className="max-w-[160px] truncate text-ink-soft" title={p.member.captainNote ?? undefined}>{p.member.captainNote || "-"}</td>
              {ended ? (
                <td className="col-action">
                  <div className="flex items-center gap-3">
                    <button type="button" className="text-sm font-medium text-brand transition-colors hover:text-brand-hover" onClick={() => void mark(p.memberId, "present")}>标记已到场</button>
                    <button type="button" className="text-sm font-medium text-ink-soft transition-colors hover:text-ink" onClick={() => void mark(p.memberId, "absent")}>标记未到场</button>
                  </div>
                </td>
              ) : (
                <td className="col-action text-xs text-ink-weak">活动结束后可标记</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
