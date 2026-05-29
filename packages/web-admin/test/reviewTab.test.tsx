import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import ReviewTab from "../src/pages/tabs/ReviewTab.js";
import { ToastProvider } from "../src/components/Toast.js";

const detail = { id:"a1", name:"训练", type:"training", status:"ended" };
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const u = String(url);
    if (u.endsWith("/review") && (!init || init.method!=="PUT")) return { ok:true, status:200, json: async()=>({ rawNotes:"今天发球不错", aiSummary:null }) } as Response;
    if (u.endsWith("/review/generate")) return { ok:true, status:200, json: async()=>({ overall:"整体不错", goalDone:"达成", problems:"无", improvements:"继续" }) } as Response;
    if (u.endsWith("/review/jobs")) return { ok:true, status:200, json: async()=>[] } as Response;
    return { ok:true, status:200, json: async()=>({}) } as Response;
  });
});

describe("ReviewTab", () => {
  it("shows '生成复盘' when rawNotes present and generates", async () => {
    render(<ToastProvider><ReviewTab detail={detail as any} /></ToastProvider>);
    expect(await screen.findByDisplayValue("今天发球不错")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "生成复盘" }));
    expect(await screen.findByText(/整体不错/)).toBeInTheDocument();
  });
});
