import { post } from "../../api.js";
type P = { memberId:string; attendanceResponse:string; actualAttendance:string|null; member:{ name:string; jerseyNumber:string|null; primaryPosition:string; backupPosition:string|null; level:string|null; style:string|null; status:string; captainNote:string|null } };
type Detail = { id:string; participants:P[] };
const resp: Record<string,string> = { going:"去", not_going:"不去", no_response:"未反馈" };
const act: Record<string,string> = { present:"已到场", absent:"未到场", pending:"待确认" };

export default function AttendanceTab({ detail, onChanged }: { detail: Detail; onChanged: ()=>void }) {
  async function mark(memberId:string, value:"present"|"absent") {
    await post(`/api/admin/activities/${detail.id}/participants/${memberId}/attendance`, { value });
    onChanged();
  }
  return (
    <table className="w-full bg-white rounded-card border text-sm">
      <thead><tr className="text-left text-gray-500 border-b">{["姓名","活动前反馈","实际到场","状态","号码","擅长位置","备选位置","水平","风格","队长备注","操作"].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
      <tbody>{detail.participants.map((p)=>(
        <tr key={p.memberId} className="border-b">
          <td className="p-2">{p.member.name}</td><td className="p-2">{resp[p.attendanceResponse]}</td>
          <td className="p-2">{p.actualAttendance ? act[p.actualAttendance] : "—"}</td>
          <td className="p-2">{p.member.status==="active"?"正常":"离队"}</td><td className="p-2">{p.member.jerseyNumber ?? "-"}</td>
          <td className="p-2">{p.member.primaryPosition}</td><td className="p-2">{p.member.backupPosition ?? "-"}</td>
          <td className="p-2">{p.member.level ?? "-"}</td><td className="p-2">{p.member.style ?? "-"}</td><td className="p-2">{p.member.captainNote || "-"}</td>
          <td className="p-2 whitespace-nowrap">
            <button className="text-blue-600 mr-2" onClick={()=>void mark(p.memberId,"present")}>标记已到场</button>
            <button className="text-gray-600" onClick={()=>void mark(p.memberId,"absent")}>标记未到场</button>
          </td>
        </tr>))}
      </tbody>
    </table>
  );
}
