import { useState } from "react";
import { KeyRound, LockKeyhole, UserRound } from "lucide-react";
import { localStore } from "@/api/localStore";
import { useAuth } from "@/lib/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await login(username, password);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const requestReset = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await localStore.users.requestPasswordReset(username);
      setMessage("Your request was sent to the owner for approval.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f4f1] flex items-center justify-center p-4 font-paragraph">
      <section className="w-full max-w-md bg-white border border-neutral-200 rounded-lg p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-[#111111] text-white flex items-center justify-center font-semibold">ANB</div>
          <div>
            <h1 className="text-lg font-semibold text-[#111111]">Haven Ventures</h1>
            <p className="text-sm text-neutral-500">Inventory and point of sale</p>
          </div>
        </div>

        <h2 className="text-xl font-medium text-[#111111]">{resetMode ? "Request password reset" : "Sign in"}</h2>
        <p className="text-sm text-neutral-500 mt-1">{resetMode ? "The owner must approve a new password." : "Use the username and password given by the owner."}</p>

        <form className="mt-6 space-y-4" onSubmit={resetMode ? requestReset : signIn}>
          <label className="block">
            <span className="text-xs text-neutral-500">Username</span>
            <div className="relative mt-1">
              <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-md text-sm focus:outline-none focus:border-[#ff9000]" />
            </div>
          </label>
          {!resetMode && <label className="block">
            <span className="text-xs text-neutral-500">Password</span>
            <div className="relative mt-1">
              <LockKeyhole size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full h-11 pl-9 pr-3 border border-neutral-200 rounded-md text-sm focus:outline-none focus:border-[#ff9000]" />
            </div>
          </label>}
          {message && <p className="text-sm text-[#b54635]">{message}</p>}
          <button disabled={busy} className="w-full h-11 rounded-md bg-[#111111] text-white text-sm font-medium disabled:opacity-50">
            {busy ? "Please wait..." : resetMode ? "Request approval" : "Sign in"}
          </button>
        </form>

        <button onClick={() => { setResetMode((value) => !value); setMessage(""); }} className="mt-5 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-[#111111] bg-transparent border-0 p-0">
          <KeyRound size={15} /> {resetMode ? "Back to sign in" : "Forgot password?"}
        </button>
      </section>
    </main>
  );
}
