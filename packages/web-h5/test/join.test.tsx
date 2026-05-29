import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import JoinPage from "../src/JoinPage.js";
import type { FeishuBridge } from "../src/feishu.js";

const okBridge: FeishuBridge = { async getCode(){ return "ou_a"; } };
const failBridge: FeishuBridge = { async getCode(){ return null; } };
beforeEach(() => { vi.restoreAllMocks(); history.replaceState({}, "", "/?t=fixed-join-token-001&code=ou_a"); });

function mockJoin(status: string) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok:true, status:200, json: async()=>({ status }) } as Response);
}

describe("JoinPage", () => {
  it("identity failure shows '请在飞书内打开'", async () => {
    render(<JoinPage bridge={failBridge} />);
    expect(await screen.findByText("请在飞书内打开")).toBeInTheDocument();
  });
  it("submits form and shows joined + Bot guidance on success (F2)", async () => {
    mockJoin("created");
    render(<JoinPage bridge={okBridge} />);
    await userEvent.type(await screen.findByLabelText("姓名"), "甲");
    await userEvent.selectOptions(screen.getByLabelText("擅长位置"), "tekong");
    await userEvent.click(screen.getByRole("button", { name: "申请加入球队" }));
    expect(await screen.findByText("已加入球队")).toBeInTheDocument();
    expect(screen.getByText(/请在飞书.*打开.*Bot/)).toBeInTheDocument();
  });
  it("already joined shows joined", async () => {
    mockJoin("already_joined");
    render(<JoinPage bridge={okBridge} />);
    await userEvent.type(await screen.findByLabelText("姓名"), "甲");
    await userEvent.selectOptions(screen.getByLabelText("擅长位置"), "tekong");
    await userEvent.click(screen.getByRole("button", { name: "申请加入球队" }));
    expect(await screen.findByText("已加入球队")).toBeInTheDocument();
  });
});
