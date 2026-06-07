import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Shield, ShieldCheck, LogOut, Trophy } from "lucide-react";
import { useAdmin } from "@/lib/admin-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const links = [
  { to: "/", label: "หน้าหลัก" },
  { to: "/players", label: "ผู้เล่น" },
  { to: "/matches", label: "แมตช์" },
] as const;

export function AppHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, login, logout } = useAdmin();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(pin);
      toast.success("เข้าสู่โหมด Admin แล้ว");
      setOpen(false);
      setPin("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PIN ไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-primary shadow-[var(--shadow-glow)]">
            <Trophy className="size-5" />
          </span>
          <span className="font-bold tracking-tight text-foreground">SmashLog</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = l.to === "/" ? path === "/" : path.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <>
              <span className="hidden items-center gap-1.5 rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">
                <ShieldCheck className="size-3.5" /> Admin
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Shield className="size-4" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}
        </div>
      </div>

      <nav className="flex items-center gap-1 border-t border-border/60 px-4 py-2 md:hidden">
        {links.map((l) => {
          const active = l.to === "/" ? path === "/" : path.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium ${
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เข้าสู่โหมด Admin</DialogTitle>
            <DialogDescription>
              ใส่รหัส PIN เพื่อปลดล็อกการเพิ่ม/แก้ไข/ลบข้อมูล
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Admin PIN</Label>
              <Input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading || !pin}>
                {loading ? "กำลังตรวจสอบ..." : "ยืนยัน"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
