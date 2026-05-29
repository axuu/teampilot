import React from "react";
import { createRoot } from "react-dom/client";
import JoinPage from "./JoinPage.js";
import { realFeishuBridge } from "./feishu.js";
import "./index.css";
createRoot(document.getElementById("root")!).render(<React.StrictMode><JoinPage bridge={realFeishuBridge} /></React.StrictMode>);
