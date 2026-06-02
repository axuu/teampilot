import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    if (u.includes("/review/transcribe")) return { ok:true, status:200, json: async()=>({ text:"转写文本" }) } as Response;
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

  it("saves current unblurred notes before transcribing", async () => {
    const calls: string[] = [];
    let putBody: any = null;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.endsWith("/review") && init?.method === "PUT") { calls.push("put"); putBody = JSON.parse(String(init.body)); return { ok:true, status:200, json: async()=>({}) } as Response; }
      if (u.endsWith("/review")) return { ok:true, status:200, json: async()=>({ rawNotes:"已有内容", aiSummary:null }) } as Response;
      if (u.includes("/review/transcribe")) { calls.push("transcribe"); return { ok:true, status:200, json: async()=>({ text:"转写文本" }) } as Response; }
      return { ok:true, status:200, json: async()=>({}) } as Response;
    });
    render(<ToastProvider><ReviewTab detail={detail as any} /></ToastProvider>);
    const ta = await screen.findByDisplayValue("已有内容");
    await userEvent.type(ta, "手输补充");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, new File(["x"], "a.mp3", { type: "audio/mpeg" }));
    await waitFor(() => expect(calls).toEqual(["put", "transcribe"]));
    expect(putBody.rawNotes).toContain("手输补充");
  });
});
