import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import SummaryTab from "../src/pages/tabs/SummaryTab.js";

const detail = { id:"a1", type:"training", status:"published", startTime:new Date().toISOString(), durationMinutes:120, location:"x", theme:null, notes:null, summary:null };
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url).endsWith("/notifications/retry") && init?.method==="POST") return { ok:true, status:200, json: async()=>({ success:2, failed:0 }) } as Response;
    if (String(url).includes("/notifications")) return { ok:true, status:200, json: async()=>({ success:1, failed:1 }) } as Response;
    return { ok:true, status:200, json: async()=>({}) } as Response;
  });
});

describe("SummaryTab notification status", () => {
  it("shows success/failed counts and a retry button when failed>0", async () => {
    render(<SummaryTab detail={detail as any} />);
    expect(await screen.findByText(/1\s*成功/)).toBeInTheDocument();
    expect(screen.getByText(/1\s*失败/)).toBeInTheDocument();
    expect(screen.getByText(/1\s*成功\s*｜\s*1\s*失败/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重试失败通知" }));
    expect(await screen.findByText(/0\s*失败/)).toBeInTheDocument();
  });
  it("renders persisted advice on initial load with a regenerate button", async () => {
    const withAdvice = { ...detail, advice: JSON.stringify({ goal:"既定目标", plan:"既定安排" }) };
    render(<SummaryTab detail={withAdvice as any} />);
    expect(await screen.findByText(/既定目标/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新生成" })).toBeInTheDocument();
  });
});
