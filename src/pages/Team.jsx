import { useState, useEffect, useCallback } from "react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime } from "@/lib/format";
import { KeyRound, Plus, UserX } from "lucide-react";

const ROLES = [
  { value: "user", label: "Cashier" },
  { value: "admin", label: "Owner / Admin" },
];
const roleLabel = (role) => (role === "admin" ? "Owner / Admin" : "Cashier");
const roleStyle = (role) => role === "admin" ? { background: "#111111", color: "#FFFFFF" } : { background: "#FF9000", color: "#111111" };
const inputClass = "w-full h-11 rounded-md border border-neutral-200 px-3 text-sm focus:outline-none focus:border-[#ff9000]";

export default function Team() {
  const { user, checkUserAuth } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [account, setAccount] = useState({ full_name: "", username: "", password: "", role: "user" });
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const isOwner = user?.role === "admin";

  const refresh = useCallback(() => {
    localStore.entities.User.list().then((items) => { setUsers(items); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(refresh, [refresh]);

  const createAccount = async () => {
    setBusy(true);
    try {
      await localStore.users.createAccount(account);
      toast({ title: "Employee account created", description: `${account.username} can now sign in with the password you set.` });
      setAccountOpen(false);
      setAccount({ full_name: "", username: "", password: "", role: "user" });
      refresh();
    } catch (error) {
      toast({ title: "Could not create account", description: error.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const changeRole = async (target, role) => {
    setBusy(true);
    try {
      await localStore.entities.User.update(target.id, { role });
      await checkUserAuth();
      toast({ title: "Role updated", description: `${target.full_name} is now ${roleLabel(role)}.` });
      refresh();
    } finally { setBusy(false); }
  };

  const setPassword = async () => {
    setBusy(true);
    try {
      await localStore.users.setPassword(resetUser.id, newPassword);
      toast({ title: "Password approved and updated", description: `${resetUser.full_name} can now sign in with the new password.` });
      setResetUser(null);
      setNewPassword("");
      refresh();
    } catch (error) {
      toast({ title: "Could not set password", description: error.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const removeUser = async (target) => {
    setBusy(true);
    try {
      await localStore.users.revokeAccount(target.id);
      setConfirmId(null);
      toast({ title: "Access removed", description: `${target.full_name} can no longer sign in.` });
      refresh();
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-40"><div className="w-8 h-8 border-4 border-neutral-200 border-t-[#111111] rounded-full animate-spin" /></div>;
  if (!isOwner) return <div className="bg-white rounded-lg p-12 text-center"><p className="text-sm text-neutral-400">Only the owner can manage employee accounts.</p></div>;

  const resetRequests = users.filter((item) => item.password_reset_requested);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-heading font-light text-[#111111]">Team</h1><p className="text-sm text-neutral-500 mt-1">Create accounts and control access for your employees.</p></div>
        <button onClick={() => setAccountOpen(true)} className="h-11 px-5 rounded-md bg-[#ff9000] text-sm font-medium text-[#111111] flex items-center gap-2 border-0"><Plus size={15} /> Create employee account</button>
      </div>

      {resetRequests.length > 0 && <section className="bg-[#fff3e6] border border-[#ffd49b] rounded-lg p-5">
        <div className="flex items-center gap-2"><KeyRound size={17} className="text-[#b56800]" /><h2 className="text-sm font-medium text-[#111111]">Password reset requests</h2></div>
        <div className="mt-3 space-y-2">{resetRequests.map((target) => <div key={target.id} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-md px-3 py-2"><span className="text-sm text-[#111111]">{target.full_name} <span className="text-neutral-500">({target.username})</span></span><button onClick={() => setResetUser(target)} className="h-9 px-3 rounded-md bg-[#111111] text-white text-xs border-0">Approve and set password</button></div>)}</div>
      </section>}

      <section className="bg-white rounded-lg p-5">
        {users.map((target) => <div key={target.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-neutral-100 last:border-0">
          <div className="min-w-0"><p className="text-sm font-medium text-[#111111]">{target.full_name}</p><p className="text-xs text-neutral-400">@{target.username} {target.created_date ? `· joined ${formatDateTime(target.created_date)}` : ""}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full font-medium" style={target.status === "inactive" ? { background: "#e5e5e5", color: "#666" } : roleStyle(target.role)}>{target.status === "inactive" ? "Access removed" : `${target.id === user.id ? "You · " : ""}${roleLabel(target.role)}`}</span>
            {target.password_reset_requested && <span className="text-xs text-[#b56800]">Reset requested</span>}
            <button onClick={() => setResetUser(target)} className="h-9 px-3 rounded-md border border-neutral-200 bg-white text-xs flex items-center gap-1.5"><KeyRound size={14} /> {target.id === user.id ? "Change password" : "Set password"}</button>
            {target.id !== user.id && target.status !== "inactive" && <><select value={target.role} disabled={busy} onChange={(event) => changeRole(target, event.target.value)} className="h-9 rounded-md text-xs px-2 border border-neutral-200 bg-white">{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select><button disabled={busy} onClick={() => confirmId === target.id ? removeUser(target) : setConfirmId(target.id)} className="h-9 px-3 rounded-md bg-[#fdeae6] text-[#b54635] text-xs flex items-center gap-1.5 border-0">{confirmId === target.id ? "Confirm removal" : <><UserX size={14} /> Remove</>}</button></>}
          </div>
        </div>)}
      </section>

      {accountOpen && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAccountOpen(false)}><div className="bg-white rounded-lg p-6 w-full max-w-sm" onClick={(event) => event.stopPropagation()}><h2 className="text-base font-medium text-[#111111]">Create employee account</h2><div className="mt-4 space-y-3"><input value={account.full_name} onChange={(event) => setAccount({ ...account, full_name: event.target.value })} placeholder="Employee full name" className={inputClass} /><input value={account.username} onChange={(event) => setAccount({ ...account, username: event.target.value })} placeholder="Username" autoComplete="off" className={inputClass} /><input type="password" value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} placeholder="Temporary password (6+ characters)" autoComplete="new-password" className={inputClass} /><select value={account.role} onChange={(event) => setAccount({ ...account, role: event.target.value })} className={inputClass}>{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></div><div className="flex gap-2 mt-5"><button onClick={() => setAccountOpen(false)} className="flex-1 h-11 rounded-md bg-neutral-100 text-sm border-0">Cancel</button><button disabled={busy} onClick={createAccount} className="flex-1 h-11 rounded-md bg-[#ff9000] text-sm font-medium border-0 disabled:opacity-50">Create account</button></div></div></div>}

      {resetUser && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setResetUser(null)}><div className="bg-white rounded-lg p-6 w-full max-w-sm" onClick={(event) => event.stopPropagation()}><h2 className="text-base font-medium text-[#111111]">Set password</h2><p className="text-sm text-neutral-500 mt-1">Set a new password for {resetUser.full_name}.</p><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (6+ characters)" autoComplete="new-password" className={inputClass + " mt-4"} /><div className="flex gap-2 mt-5"><button onClick={() => setResetUser(null)} className="flex-1 h-11 rounded-md bg-neutral-100 text-sm border-0">Cancel</button><button disabled={busy || newPassword.length < 6} onClick={setPassword} className="flex-1 h-11 rounded-md bg-[#111111] text-white text-sm border-0 disabled:opacity-50">Approve password</button></div></div></div>}
    </div>
  );
}
