"use client";

import { useEffect, useState } from "react";
import { 
  Users as UsersIcon, 
  UserPlus, 
  Shield, 
  Eye, 
  MoreVertical,
  Activity,
  UserCheck,
  Search,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getUsers, createUser } from "@/lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createUser({
        username: newUsername,
        password: newPassword,
        role: newRole
      });
      setShowAddModal(false);
      setNewUsername("");
      setNewPassword("");
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error creating user");
    }
  };

  return (
    <div className="space-y-10 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="heading-xl">Access Control</h1>
          <p className="body-md mt-2 text-[var(--color-text-muted)]">Manage administrators and analysts authorized to use the platform.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary shadow-lg"
        >
          <UserPlus className="w-5 h-5 mr-3" />
          Authorize User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 flex items-center gap-4 bg-white border-[var(--color-border-soft)]">
          <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600">
            <UsersIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Users</p>
            <h3 className="text-2xl font-bold text-[var(--color-primary-900)]">{users.length}</h3>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-4 bg-white border-[var(--color-border-soft)]">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Admins</p>
            <h3 className="text-2xl font-bold text-[var(--color-primary-900)]">{users.filter(u => u.role === 'admin').length}</h3>
          </div>
        </div>
        <div className="card p-6 flex items-center gap-4 bg-white border-[var(--color-border-soft)]">
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Access Nodes</p>
            <h3 className="text-2xl font-bold text-[var(--color-primary-900)]">Operational</h3>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden shadow-sm border-[var(--color-border-soft)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Identity</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Role</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">System ID</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 italic font-body">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-8 py-8 h-20" />
                  </tr>
                ))
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-200 group-hover:border-[var(--color-primary-400)] transition-colors">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-[var(--color-primary-900)] block uppercase tracking-tight">{user.username}</span>
                          <span className="text-[10px] text-slate-400 font-semibold">{user.username}@sprout-platform.local</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[10px] font-bold uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-sky-50 text-sky-600 border border-sky-100'
                      }`}>
                        {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {user.role}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-mono text-slate-400">#{user.id.toString().padStart(4, '0')}</td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-2 text-slate-300 hover:text-[var(--color-primary-800)] transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-[var(--color-primary-900)]/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md card p-10 rounded-3xl z-10 shadow-2xl"
            >
              <h2 className="heading-md mb-2">Create New Access</h2>
              <p className="body-sm mb-8 text-[var(--color-text-muted)]">Assign credentials and role for the new user.</p>
              
              <form onSubmit={handleAddUser} className="space-y-6">
                {error && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs py-3 px-4 rounded-xl font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                    <Search className="w-3 h-3" />
                    Username Identity
                  </label>
                  <input 
                    required
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="ex: nicolas_admin"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[var(--color-text-body)] font-semibold outline-none focus:border-[var(--color-primary-600)] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    Secure Password
                  </label>
                  <input 
                    required
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[var(--color-text-body)] font-semibold outline-none focus:border-[var(--color-primary-600)] transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 flex items-center gap-2">
                    <Shield className="w-3 h-3" />
                    Role Selection
                  </label>
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[var(--color-text-body)] font-semibold outline-none focus:border-[var(--color-primary-600)] transition-all appearance-none cursor-pointer pr-10"
                    style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23677489\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                  >
                    <option value="viewer">Analyst (View Only)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn btn-secondary flex-1 shadow-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="btn btn-primary flex-1 shadow-lg shadow indigo-500/20"
                  >
                    Authorize Access
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
