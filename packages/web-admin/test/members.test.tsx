import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Members from "../src/pages/Members.js";
import { ToastProvider } from "../src/components/Toast.js";

const members = [
  { id: "m1", name: "甲", jerseyNumber: "7", primaryPosition: "tekong", backupPosition: null, level: "advanced", style: "进攻型", status: "active", captainNote: "核心发球手，注意调度" },
];
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    if (String(url).includes("/api/admin/members")) return { ok: true, status: 200, json: async () => members } as Response;
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

function renderPage() { return render(<ToastProvider><MemoryRouter><Members /></MemoryRouter></ToastProvider>); }

describe("Members", () => {
  it("renders members, captainNote column and Chinese enum labels", async () => {
    renderPage();
    expect(await screen.findByText("甲")).toBeInTheDocument();
    expect(screen.getByText("队长备注")).toBeInTheDocument();
    expect(screen.getByText("核心发球手，注意调度")).toBeInTheDocument();
    expect(screen.getByText("发球手")).toBeInTheDocument();
    expect(screen.getByText("高水平")).toBeInTheDocument();
  });
  it("invite modal shows new copy and copies link", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "邀请队员" }));
    expect(screen.getByText('点击"复制链接"获取邀请地址，并在飞书中发送。')).toBeInTheDocument();
    expect(screen.queryByText(/请将以下链接在飞书中发给同学/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "复制链接" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
  it("edit modal has visible labels and no remaining counter", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "编辑" }));
    const dialog = screen.getByText("编辑队员").closest("div")!;
    expect(within(dialog).getByText("姓名")).toBeInTheDocument();
    expect(within(dialog).getByText("主要位置")).toBeInTheDocument();
    expect(screen.queryByText(/剩余\s*\d+/)).toBeNull();
  });
});
