import { useEffect, useState } from "react";
import { get, put } from "../api.js";
import { useToast } from "../components/Toast.js";

export default function Settings() {
  const toast = useToast();
  const [trainingRules, setT] = useState(""); const [matchRules, setM] = useState("");
  useEffect(() => { void get<any>("/api/admin/settings").then((s) => { setT(s.trainingRules); setM(s.matchRules); }); }, []);
  async function save() {
    try { await put("/api/admin/settings", { trainingRules, matchRules }); toast("已保存"); }
    catch { toast("保存失败，请重试"); }
  }
  return (
    <div className="max-w-doc space-y-7">
      <h1 className="text-lg font-semibold text-ink">设置</h1>

      <div>
        <label className="text-base font-semibold text-ink">训练规则</label>
        <p className="mb-2 mt-0.5 text-xs text-ink-weak">填写你对训练安排的偏好和经验。AI 在生成训练建议时会优先参考这里的内容。</p>
        <textarea className="textarea h-32" value={trainingRules} onChange={(e) => setT(e.target.value)} placeholder="例如：每次训练必须包含发球练习；新队员优先安排基础动作……" />
      </div>

      <div>
        <label className="text-base font-semibold text-ink">比赛规则</label>
        <p className="mb-2 mt-0.5 text-xs text-ink-weak">填写你对比赛策略和阵容的偏好。AI 在生成比赛建议时会优先参考这里的内容。</p>
        <textarea className="textarea h-32" value={matchRules} onChange={(e) => setM(e.target.value)} placeholder="例如：优先保证 Tekong 位置稳定；比分落后时换上爆发力强的 Striker……" />
      </div>

      <button className="btn-primary" onClick={() => void save()}>保存</button>
    </div>
  );
}
