import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Wand2, ArrowLeft, ArrowRight, Check, Calendar, ChevronRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Session, Match } from "@/lib/types";
import { useAdmin } from "@/lib/admin-context";
import { createSession, deleteSession } from "@/lib/admin.functions";
import { skillCode } from "@/lib/skill";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/matches")({
  head: () => ({
    meta: [
      { title: "แมตช์ — SmashLog" },
      { name: "description", content: "บันทึกก๊วนแบดมินตันคู่ พร้อมจับคู่อัตโนมัติตามระดับฝีมือ" },
    ],
  }),
  component: MatchesPage,
});

function MatchesPage() {
  const { isAdmin, pin } = useAdmin();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const playersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").order("name");
      if (error) throw error;
      return data as Player[];
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("played_at", { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
  });

  const matchesQ = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*");
      if (error) throw error;
      return data as unknown as Match[];
    },
  });

  const players = playersQ.data ?? [];
  const sessions = sessionsQ.data ?? [];
  const matches = matchesQ.data ?? [];

  const matchesBySession = useMemo(() => {
    const m = new Map<string, Match[]>();
    for (const x of matches) {
      if (!x.session_id) continue;
      const arr = m.get(x.session_id) ?? [];
      arr.push(x);
      m.set(x.session_id, arr);
    }
    return m;
  }, [matches]);

  const delFn = useServerFn(deleteSession);
  const handleDelete = async (s: Session) => {
    if (!pin) return;
    if (!confirm(`ลบก๊วน "${s.name}" และแมตช์ทั้งหมดในก๊วน?`)) return;
    try {
      await delFn({ data: { pin, id: s.id } });
      toast.success("ลบก๊วนแล้ว");
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ก๊วน / แมตช์</h1>
          <p className="mt-1 text-sm text-muted-foreground">{sessions.length} ก๊วนทั้งหมด</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setOpen(true)} disabled={players.length < 4}>
            <Plus className="size-4" /> สร้างก๊วน
          </Button>
        )}
      </div>

      {!isAdmin && (
        <Card className="mb-4 border-accent/40 bg-accent/10 p-3 text-xs text-foreground">
          โหมดดูอย่างเดียว · เข้าสู่โหมด Admin เพื่อสร้างหรือลบก๊วน
        </Card>
      )}

      {sessionsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : sessions.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">ยังไม่มีก๊วน</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sessions.map((s) => {
            const ms = matchesBySession.get(s.id) ?? [];
            const completed = ms.filter((x) => x.status === "completed").length;
            return (
              <Card key={s.id} className="group overflow-hidden p-0 transition hover:shadow-[var(--shadow-card)]">
                <Link to="/sessions/$sessionId" params={{ sessionId: s.id }} className="block">
                  <div className="bg-[image:var(--gradient-hero)] px-4 py-3 text-primary-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-base font-bold">{s.name}</h3>
                      <ChevronRight className="size-4 shrink-0 opacity-70 transition group-hover:translate-x-0.5" />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-white/75">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(s.played_at).toLocaleDateString("th-TH", { dateStyle: "long" })}
                      </span>
                    </div>
                  </div>
                </Link>
                <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Wand2 className="size-3.5 text-accent" /> {ms.length} คู่แข่ง
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3.5 text-accent" /> {completed} จบแล้ว
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(s)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isAdmin && players.length >= 4 && (
        <CreateSessionDialog open={open} onOpenChange={setOpen} players={players} />
      )}
    </main>
  );
}

// --- Wizard Dialog ---
function CreateSessionDialog({
  open,
  onOpenChange,
  players,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  players: Player[];
}) {
  const { pin } = useAdmin();
  const qc = useQueryClient();
  const createFn = useServerFn(createSession);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [playedAt, setPlayedAt] = useState(toDateInput(new Date()));
  const [poolIds, setPoolIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setName("");
      setPlayedAt(toDateInput(new Date()));
      setPoolIds([]);
      setNotes("");
    }
  }, [open]);

  const togglePool = (id: string) =>
    setPoolIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canNext1 = name.trim().length > 0 && playedAt.length > 0;
  const canSubmit = poolIds.length >= 4;

  const submit = async () => {
    if (!pin) return;
    if (!canSubmit) return toast.error("ต้องเลือกผู้เล่นอย่างน้อย 4 คน");
    setLoading(true);
    try {
      await createFn({
        data: {
          pin,
          name: name.trim(),
          played_at: new Date(playedAt + "T00:00:00").toISOString(),
          notes: notes.trim() || null,
          player_ids: poolIds,
        },
      });
      toast.success("บันทึกก๊วนแล้ว");
      qc.invalidateQueries({ queryKey: ["sessions"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>สร้างก๊วนใหม่</DialogTitle>
        </DialogHeader>

        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-name">ชื่อก๊วน</Label>
              <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="เช่น ก๊วนวันอาทิตย์" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-date">วันที่</Label>
              <Input id="s-date" type="date" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-notes">หมายเหตุ (ไม่บังคับ)</Label>
              <Input id="s-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              เลือกผู้เล่นที่เข้าร่วมก๊วน ({poolIds.length} คน · ต้องอย่างน้อย 4)
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setPoolIds(players.map((p) => p.id))}>เลือกทั้งหมด</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPoolIds([])}>ล้าง</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {players.map((p) => {
                const on = poolIds.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePool(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      on
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-accent/60"
                    }`}
                  >
                    {p.name} · {skillCode(p.skill_level)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
            <ArrowLeft className="size-4" /> ย้อน
          </Button>
          {step < 2 ? (
            <Button type="button" onClick={() => setStep(2)} disabled={!canNext1}>
              ถัดไป <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={loading || !canSubmit}>
              <Check className="size-4" /> {loading ? "กำลังบันทึก..." : "บันทึกก๊วน"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["ชื่อก๊วน + วันที่", "ผู้เล่น"];
  return (
    <div className="flex items-center gap-1.5 py-2">
      {steps.map((s, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={s} className="flex flex-1 items-center gap-1.5">
            <div className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
              active ? "bg-primary text-primary-foreground" : done ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
            }`}>{done ? <Check className="size-3" /> : n}</div>
            <span className={`text-xs ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
