import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Members from "../src/pages/Members.js";
import { ToastProvider } from "../src/components/Toast.js";

const members = [
  { id: "m1", name: "甲", jerseyNumber: "7", primaryPosition: "tekong", backupPosition: null, level: "advanced", style: "进攻型", status: "active", captainNote: "" },
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
  it("renders members and the invite button", async () => {
    renderPage();
    expect(await screen.findByText("甲")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "邀请队员" })).toBeInTheDocument();
  });
  it("invite modal copies the fixed link", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "邀请队员" }));
    await userEvent.click(screen.getByRole("button", { name: "复制链接" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
  it("edit modal shows captainNote remaining counter", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "编辑" }));
    const note = screen.getByLabelText("队长备注");
    await userEvent.type(note, "好");
    expect(within(screen.getByTestId("note-field")).getByText(/剩余\s*99/)).toBeInTheDocument();
  });
});
