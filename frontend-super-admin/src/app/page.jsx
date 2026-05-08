"use client";
import { useState, useEffect } from "react";
import { api, saveTokens, clearTokens } from "@/lib/api";

export default function SuperAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      setAuthed(true);
      fetchOrgs();
    }
  }, []);

  async function fetchOrgs() {
    try {
      const data = await api.getOrgs();
      setOrgs(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(email, password);
      if (data.role !== "SUPER_ADMIN") throw new Error("Not a super admin account");
      saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setAuthed(true);
      await fetchOrgs();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrg(e) {
    e.preventDefault();
    setError("");
    try {
      const org = await api.createOrg(orgName);
      setOrgs((prev) => [org, ...prev]);
      setOrgName("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteOrg(id, name) {
    if (!confirm(`Delete "${name}" and all its users and flags?`)) return;
    try {
      await api.deleteOrg(id);
      setOrgs((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogout() {
    try { await api.logout(); } catch {}
    clearTokens();
    setAuthed(false);
    setOrgs([]);
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-sm bg-white rounded-xl shadow p-8">
          <h1 className="text-2xl font-bold mb-6">Super Admin Login</h1>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button type="submit" disabled={loading}
              className="w-full bg-black text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-black">Logout</button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <form onSubmit={handleCreateOrg} className="flex gap-3 mb-8">
        <input
          type="text" placeholder="Organization name" value={orgName}
          onChange={(e) => setOrgName(e.target.value)} required
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button type="submit"
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
          Create Org
        </button>
      </form>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">ID</th>
              <th className="text-left px-4 py-3 font-medium">Users</th>
              <th className="text-left px-4 py-3 font-medium">Flags</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No organizations yet</td></tr>
            )}
            {orgs.map((org) => (
              <tr key={org.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{org.name}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{org.id}</td>
                <td className="px-4 py-3">{org._count?.users ?? 0}</td>
                <td className="px-4 py-3">{org._count?.featureFlags ?? 0}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(org.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDeleteOrg(org.id, org.name)}
                    className="text-red-500 hover:underline text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
