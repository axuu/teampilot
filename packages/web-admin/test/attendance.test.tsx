import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import AttendanceTab from "../src/pages/tabs/AttendanceTab.js";
import { ToastProvider } from "../src/components/Toast.js";

const member = { name:"甲", jerseyNumber:"7", primaryPosition:"tekong", backupPosition:null, level:null, style:null, status:"active", captainNote:"" };
const endedDetail = { id:"a1", name:"训练", status:"ended", participants:[{ memberId:"m1", attendanceResponse:"going", actualAttendance:"pending", member }] };
const publishedDetail = { ...endedDetail, status:"published" };

function renderTab(detail: any, onChanged = vi.fn()) {
  return render(<ToastProvider><AttendanceTab detail={detail} onChanged={onChanged} /></ToastProvider>);
}

beforeEach(() => { vi.restoreAllMocks(); });

describe("AttendanceTab", () => {
  it("marks a participant present on an ended activity", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok:true, status:200, json: async()=>({ ok:true }) } as Response);
    const onChanged = vi.fn();
    renderTab(endedDetail, onChanged);
    await userEvent.click(screen.getByRole("button", { name: "标记已到场" }));
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/participants/m1/attendance"), expect.objectContaining({ method: "POST" }));
    expect(onChanged).toHaveBeenCalled();
  });
  it("does not render mark buttons on a non-ended activity", () => {
    renderTab(publishedDetail);
    expect(screen.queryByRole("button", { name: "标记已到场" })).toBeNull();
    expect(screen.queryByRole("button", { name: "标记未到场" })).toBeNull();
  });
  it("shows a toast when marking fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok:false, status:409, json: async()=>({ error:"仅可标记已结束活动的到场" }) } as Response);
    renderTab(endedDetail);
    await userEvent.click(screen.getByRole("button", { name: "标记已到场" }));
    expect(await screen.findByText("标记失败，请重试")).toBeInTheDocument();
  });
});
