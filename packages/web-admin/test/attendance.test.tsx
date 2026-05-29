import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttendanceTab from "../src/pages/tabs/AttendanceTab.js";

const detail = {
  id:"a1", name:"训练", status:"ended",
  participants:[{ memberId:"m1", attendanceResponse:"going", actualAttendance:"pending", member:{ name:"甲", jerseyNumber:"7", primaryPosition:"tekong", backupPosition:null, level:null, style:null, status:"active", captainNote:"" } }],
};
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok:true, status:200, json: async()=>({ ok:true }) } as Response);
});

describe("AttendanceTab", () => {
  it("marks a participant present", async () => {
    const onChanged = vi.fn();
    render(<AttendanceTab detail={detail as any} onChanged={onChanged} />);
    await userEvent.click(screen.getByRole("button", { name: "标记已到场" }));
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/participants/m1/attendance"), expect.objectContaining({ method: "POST" }));
    expect(onChanged).toHaveBeenCalled();
  });
});
