import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event"; // named import (NodeNext) — match existing tests
import Assistant from "../src/pages/Assistant.js";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url).endsWith("/messages")) return { ok:true, status:200, json: async()=>[] } as Response;
    if (String(url).endsWith("/ask") && init?.method==="POST") return { ok:true, status:200, json: async()=>({ judgment:"近一月训练稳定", basis:"依据近4场出勤" }) } as Response;
    return { ok:true, status:200, json: async()=>({}) } as Response;
  });
});

describe("Assistant", () => {
  it("sends a question and shows judgment + basis", async () => {
    render(<Assistant />);
    await userEvent.type(screen.getByLabelText("提问输入"), "近一月训练情况？");
    await userEvent.click(screen.getByRole("button", { name: "发送" }));
    expect(await screen.findByText(/近一月训练稳定/)).toBeInTheDocument();
    expect(screen.getByText(/依据近4场出勤/)).toBeInTheDocument();
  });
  it("clicking an example question sends it immediately", async () => {
    render(<Assistant />);
    await userEvent.click(await screen.findByRole("button", { name: "总结近一个月内的训练情况" }));
    expect(await screen.findByText(/近一月训练稳定/)).toBeInTheDocument();
  });
  it("pressing Enter in the input sends the question", async () => {
    render(<Assistant />);
    await userEvent.type(screen.getByLabelText("提问输入"), "近一月训练情况？{Enter}");
    expect(await screen.findByText(/近一月训练稳定/)).toBeInTheDocument();
  });
});
