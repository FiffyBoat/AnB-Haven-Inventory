import { Outlet } from "react-router-dom";
import AppShell from "@/components/AppShell";

export default function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}