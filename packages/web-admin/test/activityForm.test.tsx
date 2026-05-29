import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ActivityForm from "../src/pages/ActivityForm.js";
import { ToastProvider } from "../src/components/Toast.js";

const activeMembers = [{ id:"m1", name:"甲", jerseyNumber:"7", primaryPosition:"tekong", backupPosition:null, level:null, style:null, status:"active" }];
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const u = String(url);
    if (u.includes("/api/admin/members")) return { ok:true, status:200, json: async()=>activeMembers } as Response;
    if (u.endsWith("/api/admin/activities") && init?.method==="POST") return { ok:true, status:200, json: async()=>({ id:"a1" }) } as Response;
    return { ok:true, status:200, json: async()=>({}) } as Response;
  });
});
function renderNew() {
  return render(<ToastProvider><MemoryRouter initialEntries={["/activities/new"]}><Routes><Route path="/activities/new" element={<ActivityForm />} /><Route path="/activities/:id" element={<div>详情页</div>} /></Routes></MemoryRouter></ToastProvider>);
}

describe("ActivityForm", () => {
  it("preselects all active members", async () => {
    renderNew();
    expect(await screen.findByLabelText("参加-甲")).toBeChecked();
  });
  it("loads existing activity into the form in edit mode", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/api/admin/members")) return { ok:true, status:200, json: async()=>activeMembers } as Response;
      if (/\/api\/admin\/activities\/a1$/.test(u)) return { ok:true, status:200, json: async()=>({ id:"a1", name:"已存训练", type:"training", startTime:"2026-06-01T06:30:00.000Z", durationMinutes:90, location:"老地点", theme:null, notes:null, participants:[{ memberId:"m1" }] }) } as Response;
      return { ok:true, status:200, json: async()=>({}) } as Response;
    });
    render(<ToastProvider><MemoryRouter initialEntries={["/activities/a1/edit"]}><Routes><Route path="/activities/:id/edit" element={<ActivityForm />} /></Routes></MemoryRouter></ToastProvider>);
    expect(await screen.findByDisplayValue("已存训练")).toBeInTheDocument();
    expect(screen.getByDisplayValue("老地点")).toBeInTheDocument();
  });
  it("publish opens confirm dialog requiring required fields", async () => {
    renderNew();
    await userEvent.type(screen.getByLabelText("活动名称"), "周日训练");
    await userEvent.click(screen.getByLabelText("类型-训练"));
    await userEvent.type(screen.getByLabelText("开始时间"), "2026-06-01T14:30");
    await userEvent.type(screen.getByLabelText("活动地点"), "二操场"); // 必填：否则 requiredOk=false，确认弹框不会出现
    await userEvent.click(screen.getByRole("button", { name: "发布" }));
    expect(await screen.findByText("是否要发布活动？")).toBeInTheDocument();
  });
});
