import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Radio, Checkbox } from "../src/components/Controls.js";

describe("Controls", () => {
  it("checkbox exposes aria-label, reflects checked, fires onChange", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Checkbox checked={false} onChange={onChange} ariaLabel="选我" />);
    const box = screen.getByLabelText("选我");
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(<Checkbox checked={true} onChange={onChange} ariaLabel="选我" />);
    expect(screen.getByLabelText("选我")).toBeChecked();
  });
  it("radio exposes aria-label, reflects checked, fires onChange", async () => {
    const onChange = vi.fn();
    render(<Radio name="g" checked={false} onChange={onChange} ariaLabel="单选我">文本</Radio>);
    const r = screen.getByLabelText("单选我");
    expect(r).not.toBeChecked();
    await userEvent.click(r);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText("文本")).toBeInTheDocument();
  });
});
