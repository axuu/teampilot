import { test, expect } from "@playwright/test";

const H5 = "http://localhost:5174";
const TOKEN = "e2e-join-token";

test.beforeEach(async ({ request }) => {
  await request.post("http://localhost:3000/api/test/reset");
});

test("H5 队员加入：飞书免登(假 code)→填表→提交→已加入", async ({ page }) => {
  // realFeishuBridge 从 URL ?code= 读 code；?t= 是入队 token；假 feishuAuth 把 code 当 openId
  await page.goto(`${H5}/?t=${TOKEN}&code=ou_e2e_newjoiner`);
  await page.getByLabel("姓名").fill("新队员");
  await page.getByLabel("擅长位置").selectOption("tekong");
  await page.getByRole("button", { name: "申请加入球队" }).click();
  await expect(page.getByText("已加入球队")).toBeVisible();
});

test("H5 非飞书环境（无 code）：提示在飞书内打开", async ({ page }) => {
  await page.goto(`${H5}/?t=${TOKEN}`);
  await expect(page.getByText("请在飞书内打开")).toBeVisible();
});
