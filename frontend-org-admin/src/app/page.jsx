"use client";
import { useState, useEffect } from "react";
import { api, saveTokens, clearTokens } from "@/lib/api";

export default function OrgAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState("login");
  const [flags, setFlags] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgId, setOrgId] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newEnabled, setNewEnabled] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) { setAuthed(true); fetchFlags(); }
    api.getOrgs().then(setOrgs).catch(() => {});
  }, []);

  async function fetchFlags() {
    try { setFlags(await api.getFlags()); }
    catch (err) { setError(err.message); }
  }

  async function handleLogin(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const data = await api.login(email, password);
      if (data.role !== "ORG_ADMIN") throw new Error("Not an org admin account");
      saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setAuthed(true);
      await fetchFlags();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleSignup(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const data = await api.signup(email, password, orgId);
      saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setAuthed(true);
      await fetchFlags();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleCreateFlag(e) {
    e.preventDefault(); setError("");
    try {
      const flag = await api.createFlag(newKey, newEnabled);
      setFlags((prev) => [flag, ...prev]);
      setNewKey(""); setNewEnabled(false);
    } catch (err) { setError(err.message); }
  }

  async function handleToggle(flag) {
    try {
      const updated = await api.updateFlag(flag.id, { isEnabled: !flag.isEnabled });
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? updated : f)));
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this flag?")) return;
    try {
      await api.deleteFlag(id);
      setFlags((prev) => prev.filter((f) => f.id !== id));
    } catch (err) { setError(err.message); }
  }

  async function handleLogout() {
    try { await api.logout(); } catch {}
    clearTokens(); setAuthed(false); setFlags([]);
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
          <div className="flex gap-4 mb-6">
            {["login", "signup"].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`text-sm font-medium pb-1 border-b-2 capitalize ${view === v ? "border-black" : "border-transparent text-gray-400"}`}>
                {v === "login" ? "Login" : "Sign Up"}
              </button>
            ))}
          </div>
          <h1 className="text-2xl font-bold mb-6">{view === "login" ? "Org Admin Login" : "Create Admin Account"}</h1>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <form onSubmit={view === "login" ? handleLogin : handleSignup} className="space-y-4">
            <input type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            <input type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            {view === "signup" && (
              <select value={orgId} onChange={(e) => setOrgId(e.target.value)} required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black">
                <option value="">Select organization</option>
                {orgs.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
            )}
            <button type="submit" disabled={loading}
              className="w-full bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {loading ? "Please wait..." : view === "login" ? "Login" : "Sign Up"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-black">Logout</button>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <form onSubmit={handleCreateFlag} className="flex gap-3 mb-8 items-center">
        <input type="text" placeholder="feature_key (e.g. dark_mode)" value={newKey}
          onChange={(e) => setNewKey(e.target.value)} required
          pattern="[a-z0-9_]+" title="Lowercase letters, numbers, underscores only"
          className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={newEnabled} onChange={(e) => setNewEnabled(e.target.checked)} className="w-4 h-4" />
          Enabled
        </label>
        <button type="submit"
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
          Add Flag
        </button>
      </form>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Feature Key</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Updated</th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {flags.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No flags yet — create one above</td></tr>
            )}
            {flags.map((flag) => (
              <tr key={flag.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">{flag.featureKey}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${flag.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {flag.isEnabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{new Date(flag.updatedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 flex gap-3">
                  <button onClick={() => handleToggle(flag)} className="text-blue-600 hover:underline">
                    {flag.isEnabled ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => handleDelete(flag.id)} className="text-red-500 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
