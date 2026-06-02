import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/useAuth.js";
import Login from "./pages/Login.js";
import Layout from "./components/Layout.js";
import { ToastProvider } from "./components/Toast.js";
import Members from "./pages/Members.js";
import Activities from "./pages/Activities.js";
import ActivityForm from "./pages/ActivityForm.js";
import ActivityDetail from "./pages/ActivityDetail.js";
import Settings from "./pages/Settings.js";
import Assistant from "./pages/Assistant.js";

function Shell() {
  const { me, loading, refresh } = useAuth();
  const nav = useNavigate();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-base text-ink-soft">加载中…</div>;
  if (!me) return <Login onLoggedIn={() => { void refresh().then(() => nav("/activities")); }} />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/activities" replace />} />
        <Route path="/members" element={<Members />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/activities/new" element={<ActivityForm />} />
        <Route path="/activities/:id/edit" element={<ActivityForm />} />
        <Route path="/activities/:id" element={<ActivityDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/assistant" element={<Assistant />} />
      </Routes>
    </Layout>
  );
}
export default function App() { return <ToastProvider><AuthProvider><Shell /></AuthProvider></ToastProvider>; }
