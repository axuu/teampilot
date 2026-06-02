import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

const SAMPLE_MP3 = fileURLToPath(new URL("../fixtures/sample.mp3", import.meta.url));

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await request.post("http://localhost:3000/api/test/reset");
});

test("队长后台核心 happy path：登录→建活动→选参与人→发布→通知状态→复盘转写+AI概要", async ({ page }) => {
  // 1) 登录
  await page.goto("/");
  await page.getByLabel("账号", { exact: true }).fill("Levin");
  await page.getByLabel("密码", { exact: true }).fill("change-me");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "活动管理" })).toBeVisible();

  // 2) 创建活动：校验默认值（时长 120 / 默认场地 / active 队员全选）
  await page.getByRole("link", { name: "创建活动" }).click();
  await expect(page.getByRole("heading", { name: "创建活动" })).toBeVisible();
  await expect(page.getByLabel("预计时长")).toHaveValue("120");
  await expect(page.getByLabel("活动地点")).toHaveValue("e2e训练基地");
  await expect(page.getByLabel("参加-甲")).toBeChecked();
  await expect(page.getByLabel("参加-乙")).toBeChecked();
  await expect(page.getByLabel("参加-丙")).toBeChecked();

  // 3) 选参与人：取消勾选「丙」（最终参与人 = 甲、乙，共 2 人）
  await page.getByLabel("参加-丙").uncheck();
  await expect(page.getByLabel("参加-丙")).not.toBeChecked();

  // 填必填项
  await page.getByLabel("活动名称").fill("e2e 周日训练");
  await page.getByLabel("类型-训练").check();
  await page.getByLabel("开始时间").fill("2026-06-07T18:30");

  // 4) 发布（确认弹窗 → 确认发布）
  // 注意：getByRole 的 name 默认是「子串」匹配，"发布" 会同时命中 "确认发布"，故用 exact:true
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByText("是否要发布活动？")).toBeVisible();
  await page.getByRole("button", { name: "确认发布" }).click();

  // 落到详情页（标题 = 活动名）
  await expect(page.getByRole("heading", { name: "e2e 周日训练" })).toBeVisible();

  // 5) 活动概要 Tab（默认）：通知状态 = 成功 2 / 失败 0
  const notifBlock = page.getByText("通知状态：").locator(".."); // 锚定到 "通知状态：" span 的父 div，比 .last() 稳健
  await expect(notifBlock).toContainText("2 成功 ｜ 0 失败");

  // 5b) 概要页 AI 按钮：生成训练建议（走 fakeLLM 训练助理分支）
  await page.getByRole("button", { name: "生成训练建议" }).click();
  await expect(page.getByText("（e2e）提升传球成功率")).toBeVisible();

  // 6) 活动复盘 Tab
  await page.getByRole("button", { name: "活动复盘" }).click();
  const notes = page.getByRole("textbox");
  await expect(notes).toHaveValue(""); // 等复盘初始 GET 加载完成（新活动暂无复盘记录，应为空），避免 setRaw 覆盖刚填入的文本
  await notes.fill("队员状态不错，配合默契。");
  // onBlur 触发 PUT 保存。必须等保存完成再上传，否则与转写的「读-改-写」存在竞态：
  // 后置落地的 PUT 可能覆盖掉转写文本，导致 toHaveValue 偶发失败。用 waitForResponse 同步。
  await Promise.all([
    page.waitForResponse((r) => /\/review$/.test(new URL(r.url()).pathname) && r.request().method() === "PUT"),
    notes.blur(),
  ]);

  // 上传录音 → fakeAsr 返回固定文本，后端追加进 rawNotes，前端重拉展示
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_MP3);
  await expect(notes).toHaveValue(/（e2e）这是录音转写出来的复盘文本/);
  await expect(notes).toHaveValue(/sample\.mp3 转写内容/);

  // 生成 AI 复盘概要（走 fakeLLM 复盘助理-训练分支）
  await page.getByRole("button", { name: "生成复盘" }).click();
  await expect(page.getByText(/整体总结：（e2e）整体表现稳定/)).toBeVisible();
  await expect(page.getByRole("button", { name: "重新生成" })).toBeVisible();
});
