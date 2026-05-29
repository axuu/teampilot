import { useEffect, useState } from "react";
import { get, put } from "../api.js";
import { useToast } from "../components/Toast.js";

export default function Settings() {
  const toast = useToast();
  const [trainingRules, setT] = useState(""); const [matchRules, setM] = useState("");
  useEffect(() => { void get<any>("/api/admin/settings").then((s)=>{ setT(s.trainingRules); setM(s.matchRules); }); }, []);
  async function save() { await put("/api/admin/settings", { trainingRules, matchRules }); toast("已保存"); }
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">设置</h1>
      <div>
        <label className="font-semibold">训练规则</label>
        <p className="text-xs text-gray-400">填写你对训练安排的偏好和经验。AI 在生成训练建议时会优先参考这里的内容。</p>
        <textarea className="mt-1 w-full border rounded p-2 h-32" value={trainingRules} onChange={(e)=>setT(e.target.value)} placeholder="例如：每次训练必须包含发球练习；新队员优先安排基础动作……" />
      </div>
      <div>
        <label className="font-semibold">比赛规则</label>
        <p className="text-xs text-gray-400">填写你对比赛策略和阵容的偏好。AI 在生成比赛建议时会优先参考这里的内容。</p>
        <textarea className="mt-1 w-full border rounded p-2 h-32" value={matchRules} onChange={(e)=>setM(e.target.value)} placeholder="例如：优先保证 Tekong 位置稳定；比分落后时换上爆发力强的 Striker……" />
      </div>
      <button className="bg-blue-600 text-white rounded px-4 py-1.5" onClick={()=>void save()}>保存</button>
    </div>
  );
}
