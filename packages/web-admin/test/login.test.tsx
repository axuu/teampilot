import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../src/pages/Login.js";

beforeEach(() => { vi.restoreAllMocks(); });

function mockFetch(status: number, body: object) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: status < 400, status, json: async () => body } as Response);
}

describe("Login", () => {
  it("shows unified error on failed login", async () => {
    mockFetch(401, { error: "账号或密码错误" });
    render(<MemoryRouter><Login onLoggedIn={() => {}} /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("账号"), "Levin");
    await userEvent.type(screen.getByLabelText("密码"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("账号或密码错误")).toBeInTheDocument();
  });
  it("calls onLoggedIn on success", async () => {
    mockFetch(200, { ok: true });
    const onLoggedIn = vi.fn();
    render(<MemoryRouter><Login onLoggedIn={onLoggedIn} /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText("账号"), "Levin");
    await userEvent.type(screen.getByLabelText("密码"), "change-me");
    await userEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(onLoggedIn).toHaveBeenCalled();
  });
});
