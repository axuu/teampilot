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
  it("uses OAuth state as the join token after Feishu redirects back", async () => {
    history.replaceState({}, "", "/?code=ou_a&state=fixed-join-token-001");
    mockJoin("created");
    render(<JoinPage bridge={okBridge} />);
    await userEvent.type(await screen.findByLabelText("姓名"), "甲");
    await userEvent.selectOptions(screen.getByLabelText("擅长位置"), "tekong");
    await userEvent.click(screen.getByRole("button", { name: "申请加入球队" }));
    expect(await screen.findByText("已加入球队")).toBeInTheDocument();
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.token).toBe("fixed-join-token-001");
  });
  it("already joined shows joined", async () => {
    mockJoin("already_joined");
    render(<JoinPage bridge={okBridge} />);
    await userEvent.type(await screen.findByLabelText("姓名"), "甲");
    await userEvent.selectOptions(screen.getByLabelText("擅长位置"), "tekong");
    await userEvent.click(screen.getByRole("button", { name: "申请加入球队" }));
    expect(await screen.findByText("已加入球队")).toBeInTheDocument();
  });
  it("shows an error and stays on the form when submit fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    render(<JoinPage bridge={okBridge} />);
    await userEvent.type(await screen.findByLabelText("姓名"), "甲");
    await userEvent.selectOptions(screen.getByLabelText("擅长位置"), "tekong");
    await userEvent.click(screen.getByRole("button", { name: "申请加入球队" }));
    expect(await screen.findByText("提交失败，请重试")).toBeInTheDocument();
    expect(screen.getByLabelText("姓名")).toBeInTheDocument(); // still on the form
  });
});
