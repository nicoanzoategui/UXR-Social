"use client";

import { useEffect, useState } from "react";
import {
  Users as UsersIcon,
  UserPlus,
  Shield,
  Eye,
  Trash,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getUsers, createUser, deleteUser, getMe } from "@/lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function fetchUsers() {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      setStatus({ type: "error", msg: "No se pudo cargar la lista de usuarios." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    getMe()
      .then((me) => setCurrentUserId(me.id))
      .catch(() => setCurrentUserId(null));
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setCreating(true);
    try {
      await createUser({
        username: newUsername,
        password: newPassword,
        role: newRole,
      });
      setStatus({ type: "success", msg: "Usuario creado correctamente." });
      setNewUsername("");
      setNewPassword("");
      setNewRole("viewer");
      fetchUsers();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setStatus({
        type: "error",
        msg: typeof detail === "string" ? detail : "Error al crear el usuario.",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (currentUserId === id) {
      setStatus({ type: "error", msg: "No podés eliminar tu propia cuenta." });
      return;
    }
    if (!confirm(`¿Eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    setStatus(null);
    try {
      await deleteUser(id);
      setStatus({ type: "success", msg: "Usuario eliminado." });
      fetchUsers();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setStatus({
        type: "error",
        msg: typeof detail === "string" ? detail : "Error al eliminar el usuario.",
      });
    }
  };

  return (
    <div className="space-y-12 pb-20">
      <header>
        <h1 className="heading-xl">Usuarios</h1>
        <p className="body-md mt-2 text-slate-600">
          Alta de cuentas y permisos (admin / viewer). Solo administradores.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card card-pad-lg h-full lg:col-span-2 card-interactive">
          <AnimatePresence>
            {status && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={`mb-6 flex items-center gap-3 p-4 rounded-xl text-sm font-bold border ${
                  status.type === "success"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                    : "bg-rose-50 text-rose-600 border-rose-100"
                }`}
              >
                {status.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0" />
                )}
                {status.msg}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-500/25">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="heading-md">Crear usuario</h2>
              <p className="body-sm">Usuario, contraseña y rol para acceder a la plataforma.</p>
            </div>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-6 max-w-xl">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                Usuario
              </label>
              <input
                required
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="nombre_usuario"
                autoComplete="username"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[var(--color-text-body)] font-semibold outline-none transition-all hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                Contraseña
              </label>
              <input
                required
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[var(--color-text-body)] font-semibold outline-none transition-all hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
                Rol
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "admin" | "viewer")}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[var(--color-text-body)] font-semibold outline-none transition-all hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none cursor-pointer"
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23677489\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")',
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                }}
              >
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="btn btn-primary px-8 py-4 rounded-xl font-bold text-sm uppercase tracking-wider disabled:opacity-50 min-h-0"
            >
              {creating ? "Creando…" : "Crear usuario"}
            </button>
          </form>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="heading-md flex items-center gap-3">
          <UsersIcon className="w-6 h-6 text-slate-800" />
          Usuarios registrados
        </h2>
        <div className="card overflow-hidden card-interactive">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest w-12">
                  #
                </th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Usuario
                </th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest">Rol</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center text-slate-400 body-sm">
                    Cargando…
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-5 text-xs font-bold text-slate-400">{index + 1}</td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-slate-800">{user.username}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[10px] font-bold uppercase tracking-wider ${
                          user.role === "admin"
                            ? "bg-rose-50 text-rose-600 border border-rose-100"
                            : "bg-sky-50 text-sky-600 border border-sky-100"
                        }`}
                      >
                        {user.role === "admin" ? (
                          <Shield className="w-3 h-3" />
                        ) : (
                          <Eye className="w-3 h-3" />
                        )}
                        {user.role}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        disabled={currentUserId === user.id}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none"
                        title={
                          currentUserId === user.id
                            ? "No podés eliminar tu propia cuenta"
                            : "Eliminar usuario"
                        }
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-16 text-center italic text-slate-400 body-sm text-balance">
                    No hay usuarios cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
