"use client";
import { useState, useEffect } from "react";
import { api, saveTokens, clearTokens } from "@/lib/api";

export default function EndUserPage() {
  const [authed, setAuthed] = useState(false);
  const [view, setView] = useState("login");
  const [orgs, setOrgs] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgId, setOrgId] = useState("");
  const [featureKey, setFeatureKey] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) setAuthed(true);
    api.getOrgs().then(setOrgs).catch(() => {});
  }, []);

  async function handleLogin(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const data = await api.login(email, password);
      if (data.role !== "END_USER") throw new Error("Not an end user account");
      saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setAuthed(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleSignup(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const data = await api.signup(email, password, orgId);
      saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setAuthed(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleCheck(e) {
    e.preventDefault(); setError(""); setResult(null); setLoading(true);
    try { setResult(await api.checkFlag(featureKey)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleLogout() {
    try { await api.logout(); } catch {}
    clearTokens(); setAuthed(false); setResult(null);
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
          <div className="flex gap-4 mb-6">
            {["login", "signup"].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`text-sm font-medium pb-1 border-b-2 ${view === v ? "border-black" : "border-transparent text-gray-400"}`}>
                {v === "login" ? "Login" : "Sign Up"}
              </button>
            ))}
          </div>
          <h1 className="text-2xl font-bold mb-6">{view === "login" ? "User Login" : "Create Account"}</h1>
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
                <option value="">Select your organization</option>
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
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Check Feature</h1>
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-black">Logout</button>
        </div>
        <div className="bg-white rounded-xl shadow p-8">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <form onSubmit={handleCheck} className="space-y-4">
            <input type="text" placeholder="Enter feature key (e.g. dark_mode)" value={featureKey}
              onChange={(e) => setFeatureKey(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black" />
            <button type="submit" disabled={loading}
              className="w-full bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {loading ? "Checking..." : "Check Feature"}
            </button>
          </form>
          {result && (
            <div className={`mt-6 p-4 rounded-lg text-center ${result.isEnabled ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
              <p className="font-mono text-sm text-gray-500 mb-1">{result.featureKey}</p>
              <p className={`text-2xl font-bold ${result.isEnabled ? "text-green-600" : "text-gray-400"}`}>
                {result.isEnabled ? "✓ Enabled" : "✗ Disabled"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
