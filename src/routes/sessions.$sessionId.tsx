import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Trophy, Calendar, Users, Trash2, X, Edit3, CheckCircle2, Clock, Plus, Shuffle, Wand2, Wallet, Check, UserPlus, BarChart3, LogOut } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Player, Session, Match } from "@/lib/types";
import { useAdmin } from "@/lib/admin-context";
import { updateMatchScore, deleteMatch, createMatch, updateSessionCost, updateSessionQr, updateSessionPlayerPaid, updateMatchStatus, addSessionPlayer, removeSessionPlayer } from "@/lib/admin.functions";
import { randomBalancedTeams } from "@/lib/pairing";
import { skillCode } from "@/lib/skill";
import { PlayerAvatar } from "@/components/player-avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/sessions/$sessionId")({
  head: () => ({ meta: [{ title: "ก๊วน — SmashLog" }] }),
  component: SessionDetail,
});

function SessionDetail() {
  const { sessionId } = Route.useParams();
  const { isAdmin, pin } = useAdmin();
  const qc = useQueryClient();

  const sessionQ = useQuery({
    queryKey: ["session", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (error) throw error;
      return data as Session;
    },
  });

  const playersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*");
      if (error) throw error;
      return data as Player[];
    },
  });

  const sessionPlayersQ = useQuery({
    queryKey: ["session-players", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("session_players").select("player_id, paid").eq("session_id", sessionId);
      if (error) throw error;
      return data as { player_id: string; paid: boolean }[];
    },
  });

  const matchesQ = useQuery({
    queryKey: ["session-matches", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at");
      if (error) throw error;
      return data as unknown as Match[];
    },
  });

  const session = sessionQ.data;
  const players = playersQ.data ?? [];
  const matches = matchesQ.data ?? [];
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const sessionPlayerIds = (sessionPlayersQ.data ?? []).map((x) => x.player_id);

  // matches played per player (all matches in this session)
  const playCount = new Map<string, number>();
  for (const m of matches) {
    for (const id of [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2]) {
      playCount.set(id, (playCount.get(id) ?? 0) + 1);
    }
  }

  // pending pairings — used to avoid duplicate random pairings
  const pendingMatches = matches.filter((m) => m.status !== "completed");
  const pendingPairKeys = pendingMatches.map((m) => pairKey(m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2));
  // players currently locked in a pending match (waiting to play) — exclude from random
  const busyPlayerIds = new Set<string>();
  for (const m of pendingMatches) {
    busyPlayerIds.add(m.team_a_p1);
    busyPlayerIds.add(m.team_a_p2);
    busyPlayerIds.add(m.team_b_p1);
    busyPlayerIds.add(m.team_b_p2);
  }

  const paidMap = new Map((sessionPlayersQ.data ?? []).map((x) => [x.player_id, x.paid]));

  const [minutesMap, setMinutesMap] = useState<Record<string, number>>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m: Record<string, number> = {};
    for (const pid of sessionPlayerIds) {
      const v = window.localStorage.getItem(`bm_minutes:${sessionId}:${pid}`);
      if (v) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) m[pid] = n;
      }
    }
    setMinutesMap(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionPlayerIds.join(",")]);

  const saveMinutes = (playerId: string, value: number) => {
    setMinutesMap((prev) => ({ ...prev, [playerId]: value }));
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`bm_minutes:${sessionId}:${playerId}`, String(value));
    }
  };

  const [scoring, setScoring] = useState<Match | null>(null);
  const [creatingMatch, setCreatingMatch] = useState(false);
  const delMatchFn = useServerFn(deleteMatch);
  const setStatusFn = useServerFn(updateMatchStatus);

  const handleDeleteMatch = async (m: Match) => {
    if (!pin) return;
    if (!confirm(`ลบคู่แข่ง "${m.name ?? "ไม่มีชื่อ"}"?`)) return;
    try {
      await delMatchFn({ data: { pin, id: m.id } });
      toast.success("ลบแล้ว");
      qc.invalidateQueries({ queryKey: ["session-matches", sessionId] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  };

  const handleToggleStatus = async (m: Match) => {
    if (!pin) return;
    const next = m.status === "in_progress" ? "pending" : "in_progress";
    try {
      await setStatusFn({ data: { pin, id: m.id, status: next } });
      qc.invalidateQueries({ queryKey: ["session-matches", sessionId] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปเดตสถานะไม่สำเร็จ");
    }
  };

  if (sessionQ.isLoading) return <main className="mx-auto max-w-4xl px-4 py-8">กำลังโหลด...</main>;
  if (!session) throw notFound();

  const completed = matches.filter((m) => m.status === "completed").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/matches" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> กลับ
      </Link>

      <Card className="overflow-hidden p-0">
        <div className="bg-[image:var(--gradient-hero)] p-6 text-primary-foreground">
          <h1 className="text-2xl font-bold">{session.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4" />
              {new Date(session.played_at).toLocaleDateString("th-TH", { dateStyle: "long" })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-4" /> {sessionPlayerIds.length} ผู้เล่น
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="size-4" /> {completed}/{matches.length} จบแล้ว
            </span>
          </div>
          {session.notes && <p className="mt-2 text-sm text-white/70">{session.notes}</p>}
        </div>
        <RosterEditor
          sessionId={sessionId}
          isAdmin={isAdmin}
          allPlayers={players}
          sessionPlayerIds={sessionPlayerIds}
          playerMap={playerMap}
          playCount={playCount}
          minutesMap={minutesMap}
          onSaveMinutes={saveMinutes}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["session-players", sessionId] });
          }}
        />

      </Card>


      
      <div className="mt-8 mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">คู่แข่งในก๊วน</h2>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreatingMatch(true)} disabled={sessionPlayerIds.length < 4}>
            <Plus className="size-4" /> สร้างแมตซ์
          </Button>
        )}
      </div>
      {matches.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">ก๊วนนี้ยังไม่มีคู่แข่ง — กดปุ่ม "สร้างแมตซ์" เพื่อเริ่ม</Card>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto scroll-smooth rounded-xl border border-border snap-y snap-proximity">
          <div className="grid gap-3 p-3 md:grid-cols-2">
            {[...matches]
              .sort((a, b) => {
                const num = (m: Match) => {
                  const x = m.name?.match(/\d+/);
                  return x ? parseInt(x[0], 10) : 0;
                };
                const d = num(b) - num(a);
                if (d !== 0) return d;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              })
              .map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  playerMap={playerMap}
                  onScore={isAdmin ? () => setScoring(m) : undefined}
                  onDelete={isAdmin ? () => handleDeleteMatch(m) : undefined}
                  onToggleStatus={isAdmin ? () => handleToggleStatus(m) : undefined}
                />
              ))}
          </div>
        </div>
      )}

      {scoring && (
        <ScoreDialog
          match={scoring}
          playerMap={playerMap}
          onClose={() => setScoring(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["session-matches", sessionId] });
            qc.invalidateQueries({ queryKey: ["matches"] });
          }}
        />
      )}

      <PaymentSection
        session={session}
        sessionPlayerIds={sessionPlayerIds}
        playerMap={playerMap}
        paidMap={paidMap}
        minutesMap={minutesMap}
        isAdmin={isAdmin}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["session", sessionId] });
          qc.invalidateQueries({ queryKey: ["session-players", sessionId] });
        }}
      />

      {creatingMatch && (
        <CreateMatchDialog
          sessionId={sessionId}
          poolPlayers={sessionPlayerIds
            .filter((id) => !minutesMap[id])
            .map((id) => playerMap.get(id))
            .filter((p): p is Player => !!p)}
          existingCount={matches.length}
          excludePairKeys={pendingPairKeys}
          busyPlayerIds={busyPlayerIds}
          playCount={playCount}
          onClose={() => setCreatingMatch(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["session-matches", sessionId] });
            qc.invalidateQueries({ queryKey: ["matches"] });
          }}
        />
      )}
    </main>
  );
}

function MatchCard({
  match,
  playerMap,
  onScore,
  onDelete,
  onToggleStatus,
}: {
  match: Match;
  playerMap: Map<string, Player>;
  onScore?: () => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
}) {
  const isDone = match.status === "completed";
  const isOn = match.status === "in_progress";
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-secondary/40 px-4 py-2 text-xs">
        <div className="min-w-0 flex-1 truncate font-semibold">{match.name ?? "—"}</div>
        <div className="flex items-center gap-1.5">
          {isDone ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
              <CheckCircle2 className="size-3" /> {match.winner_team === "tie" ? "เสมอ" : `ทีม ${match.winner_team} ชนะ`}
            </span>
          ) : isOn ? (
            <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-primary">
              ● On game!!!
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              <Clock className="size-3" /> Waiting
            </span>
          )}
          {!isDone && onToggleStatus && (
            <button
              type="button"
              onClick={onToggleStatus}
              aria-pressed={isOn}
              title={isOn ? "ปิดสถานะกำลังแข่ง" : "เริ่มแข่ง"}
              className={`inline-flex h-5 w-10 items-center rounded-full px-0.5 text-[9px] font-bold transition-colors ${
                isOn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full bg-background text-foreground shadow transition-transform ${
                  isOn ? "translate-x-5" : "translate-x-0"
                }`}
              >
                {isOn ? "ON" : "OFF"}
              </span>
            </button>
          )}
          {onScore && (
            <button onClick={onScore} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <Edit3 className="size-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-4">
        <TeamBlock
          p1={playerMap.get(match.team_a_p1)}
          p2={playerMap.get(match.team_a_p2)}
          win={isDone && match.winner_team === "A"}
          label="A"
        />
        <div className="text-center font-mono text-sm tabular-nums">
          {isDone && match.winner_team === "tie" ? (
            <div className="text-xs font-bold text-muted-foreground">เสมอ</div>
          ) : isDone ? (
            <Trophy className="mx-auto size-5 text-accent" />
          ) : (
            <div className="text-xs text-muted-foreground">vs</div>
          )}
        </div>
        <TeamBlock
          p1={playerMap.get(match.team_b_p1)}
          p2={playerMap.get(match.team_b_p2)}
          win={isDone && match.winner_team === "B"}
          label="B"
          align="right"
        />
      </div>
    </Card>
  );
}

function TeamBlock({ p1, p2, win, label, align }: { p1?: Player; p2?: Player; win: boolean; label: string; align?: "right" }) {
  const isRight = align === "right";
  return (
    <div className={isRight ? "text-right" : ""}>
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">ทีม {label}</div>
      <div className={`mt-1 flex items-center gap-1.5 ${isRight ? "flex-row-reverse" : ""}`}>
        <PlayerAvatar player={p1} size="sm" />
        <span className={`text-sm ${win ? "font-bold text-foreground" : "text-muted-foreground"}`}>{p1?.name ?? "?"}</span>
      </div>
      <div className={`mt-1 flex items-center gap-1.5 ${isRight ? "flex-row-reverse" : ""}`}>
        <PlayerAvatar player={p2} size="sm" />
        <span className={`text-sm ${win ? "font-bold text-foreground" : "text-muted-foreground"}`}>{p2?.name ?? "?"}</span>
      </div>
    </div>
  );
}

function ScoreDialog({
  match,
  playerMap,
  onClose,
  onSaved,
}: {
  match: Match;
  playerMap: Map<string, Player>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { pin } = useAdmin();
  const updateFn = useServerFn(updateMatchScore);
  const [winner, setWinner] = useState<"A" | "B" | "tie" | null>(
    match.winner_team === "A" || match.winner_team === "B" || match.winner_team === "tie"
      ? (match.winner_team as "A" | "B" | "tie")
      : null,
  );
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!pin || !winner) return toast.error("เลือกผลการแข่งก่อน");
    setLoading(true);
    try {
      await updateFn({ data: { pin, id: match.id, sets: [], winner_team: winner } });
      toast.success("บันทึกผลแล้ว");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const n = (id: string) => playerMap.get(id)?.name ?? "?";
  const TeamCard = ({ team, names, active }: { team: "A" | "B"; names: string; active: boolean }) => (
    <button
      type="button"
      onClick={() => setWinner(team)}
      className={`rounded-lg border-2 p-3 text-left transition ${
        active ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold">ทีม {team}</div>
        {active && <Trophy className="size-4 text-primary" />}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{names}</div>
    </button>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>บันทึกผล · {match.name ?? "—"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">เลือกทีมที่ชนะ หรือเสมอ</p>
          <div className="grid grid-cols-2 gap-2">
            <TeamCard team="A" names={`${n(match.team_a_p1)} & ${n(match.team_a_p2)}`} active={winner === "A"} />
            <TeamCard team="B" names={`${n(match.team_b_p1)} & ${n(match.team_b_p2)}`} active={winner === "B"} />
          </div>
          <button
            type="button"
            onClick={() => setWinner("tie")}
            className={`w-full rounded-lg border-2 px-3 py-2 text-sm font-semibold transition ${
              winner === "tie" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            เสมอ
          </button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={loading || !winner}>
            {loading ? "กำลังบันทึก..." : "บันทึกผล"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function pairKey(a1: string, a2: string, b1: string, b2: string) {
  const ta = [a1, a2].sort().join("|");
  const tb = [b1, b2].sort().join("|");
  return [ta, tb].sort().join("__vs__");
}

function CreateMatchDialog({
  sessionId,
  poolPlayers,
  existingCount,
  excludePairKeys,
  busyPlayerIds,
  playCount,
  onClose,
  onSaved,
}: {
  sessionId: string;
  poolPlayers: Player[];
  existingCount: number;
  excludePairKeys: string[];
  busyPlayerIds: Set<string>;
  playCount: Map<string, number>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { pin } = useAdmin();
  const createFn = useServerFn(createMatch);
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [name, setName] = useState(`คู่ที่ ${existingCount + 1}`);
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [b1, setB1] = useState("");
  const [b2, setB2] = useState("");
  const [loading, setLoading] = useState(false);

  const used = [a1, a2, b1, b2];
  const ready =
    !!a1 && !!a2 && !!b1 && !!b2 && new Set(used).size === 4;

  const doRandom = () => {
    const excluded = new Set(excludePairKeys);
    // Only consider players not currently locked in a pending match
    const available = poolPlayers.filter((p) => !busyPlayerIds.has(p.id));
    if (available.length < 4) {
      return toast.error("ผู้เล่นว่างไม่พอ — มีคนที่รอแข่งอยู่แล้ว");
    }
    // Bias toward players who have played fewer matches in this session
    const sorted = [...available].sort(
      (a, b) => (playCount.get(a.id) ?? 0) - (playCount.get(b.id) ?? 0),
    );
    const minCount = playCount.get(sorted[0]?.id ?? "") ?? 0;
    const bench = sorted.filter((p) => (playCount.get(p.id) ?? 0) <= minCount + 1);
    const candidates = bench.length >= 4 ? bench : available;

    for (let i = 0; i < 80; i++) {
      const r = randomBalancedTeams(candidates);
      if (!r) {
        if (i === 0 && candidates !== available) continue;
        return toast.error("ผู้เล่นไม่พอ");
      }
      const k = pairKey(r.teamA[0].id, r.teamA[1].id, r.teamB[0].id, r.teamB[1].id);
      if (!excluded.has(k)) {
        setA1(r.teamA[0].id);
        setA2(r.teamA[1].id);
        setB1(r.teamB[0].id);
        setB2(r.teamB[1].id);
        return;
      }
    }
    toast.error("ไม่พบคู่ใหม่ที่ไม่ซ้ำกับคู่ที่รอแข่งอยู่");
  };

  const submit = async () => {
    if (!pin) return;
    if (!ready) return toast.error("เลือกผู้เล่นให้ครบ");
    setLoading(true);
    try {
      await createFn({
        data: {
          pin,
          session_id: sessionId,
          name: name.trim() || null,
          team_a_p1: a1,
          team_a_p2: a2,
          team_b_p1: b1,
          team_b_p2: b2,
        },
      });
      toast.success("สร้างแมตซ์แล้ว");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const PSel = ({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude: string[] }) => {
    const selected = poolPlayers.find((p) => p.id === value);
    return (
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-10 text-sm">
          {selected ? (
            <span className="flex items-center gap-2">
              <PlayerAvatar player={selected} size="xs" />
              <span className="truncate">{selected.name} · {skillCode(selected.skill_level)}</span>
            </span>
          ) : (
            <SelectValue placeholder="เลือกผู้เล่น" />
          )}
        </SelectTrigger>
        <SelectContent>
          {poolPlayers
            .filter((p) => p.id === value || (!exclude.includes(p.id) && !busyPlayerIds.has(p.id)))
            .map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <PlayerAvatar player={p} size="xs" />
                  <span>{p.name} · {skillCode(p.skill_level)}</span>
                </span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>สร้างแมตซ์ใหม่</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-name">ชื่อแมตซ์</Label>
            <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "random" ? "default" : "outline"}
              onClick={() => { setMode("random"); doRandom(); }}
            >
              <Shuffle className="size-3.5" /> สุ่มตามระดับ
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => { setMode("manual"); setA1(""); setA2(""); setB1(""); setB2(""); }}
            >
              <Wand2 className="size-3.5" /> กำหนดเอง
            </Button>
            {mode === "random" && (
              <Button type="button" size="sm" variant="ghost" onClick={doRandom}>สุ่มใหม่</Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="text-xs font-bold uppercase">ทีม A</div>
              <PSel value={a1} onChange={setA1} exclude={used.filter((_, k) => k !== 0)} />
              <PSel value={a2} onChange={setA2} exclude={used.filter((_, k) => k !== 1)} />
            </div>
            <div className="space-y-2 rounded-md border border-border p-3">
              <div className="text-xs font-bold uppercase">ทีม B</div>
              <PSel value={b1} onChange={setB1} exclude={used.filter((_, k) => k !== 2)} />
              <PSel value={b2} onChange={setB2} exclude={used.filter((_, k) => k !== 3)} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <Clock className="-mt-0.5 mr-1 inline size-3" />
            จะถูกบันทึกเป็นสถานะ "รอแข่ง" คะแนนเริ่มต้น 0 : 0
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit} disabled={loading || !ready}>
            {loading ? "กำลังบันทึก..." : "บันทึกแมตซ์"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentSection({
  session,
  sessionPlayerIds,
  playerMap,
  paidMap,
  minutesMap,
  isAdmin,
  onChanged,
}: {
  session: Session;
  sessionPlayerIds: string[];
  playerMap: Map<string, Player>;
  paidMap: Map<string, boolean>;
  minutesMap: Record<string, number>;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const { pin } = useAdmin();
  const updateCostFn = useServerFn(updateSessionCost);
  const updatePaidFn = useServerFn(updateSessionPlayerPaid);
  const updateQrFn = useServerFn(updateSessionQr);
  const [editing, setEditing] = useState(false);
  const [costInput, setCostInput] = useState(String(session.total_cost ?? 0));
  const [savingCost, setSavingCost] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [qrDialogFor, setQrDialogFor] = useState<string | null>(null);

  const total = Number(session.total_cost ?? 0);
  const count = sessionPlayerIds.length;
  const perHead = count > 0 ? Math.ceil(total / count) : 0;
  const paidCount = sessionPlayerIds.filter((id) => paidMap.get(id)).length;
  const collected = perHead * paidCount;
  const qrUrl = session.qr_url ?? null;

  const saveCost = async () => {
    if (!pin) return;
    const v = Number(costInput);
    if (!Number.isFinite(v) || v < 0) return toast.error("จำนวนเงินไม่ถูกต้อง");
    setSavingCost(true);
    try {
      await updateCostFn({ data: { pin, session_id: session.id, total_cost: v } });
      toast.success("บันทึกยอดรวมแล้ว");
      setEditing(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingCost(false);
    }
  };

  const togglePaid = async (playerId: string, paid: boolean) => {
    if (!pin) return;
    try {
      await updatePaidFn({ data: { pin, session_id: session.id, player_id: playerId, paid } });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปเดตไม่สำเร็จ");
    }
  };

  const handleQrFile = async (file: File) => {
    if (!pin || !file) return;
    if (!file.type.startsWith("image/")) return toast.error("กรุณาเลือกไฟล์รูปภาพ");
    if (file.size > 5 * 1024 * 1024) return toast.error("ไฟล์ต้องไม่เกิน 5MB");
    setUploadingQr(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `qr/${session.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateQrFn({ data: { pin, session_id: session.id, qr_url: data.publicUrl } });
      toast.success("อัปโหลด QR แล้ว");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploadingQr(false);
    }
  };

  const removeQr = async () => {
    if (!pin) return;
    if (!confirm("ลบรูป QR Code?")) return;
    try {
      await updateQrFn({ data: { pin, session_id: session.id, qr_url: null } });
      toast.success("ลบรูป QR แล้ว");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  };

  const dialogPlayer = qrDialogFor ? playerMap.get(qrDialogFor) : null;

  return (
    <Card className="mt-8 overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" />
          <h2 className="text-lg font-bold">ค่าใช้จ่ายของก๊วน</h2>
        </div>
        {isAdmin && !editing && (
          <Button size="sm" variant="outline" onClick={() => { setCostInput(String(total)); setEditing(true); }}>
            <Edit3 className="size-3.5" /> ตั้งยอดรวม
          </Button>
        )}
      </div>

      {isAdmin && (
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Stat label="ยอดรวม" value={`${total.toLocaleString("th-TH")} ฿`} />
          <Stat label="หารหัวละ" value={count > 0 ? `${perHead.toLocaleString("th-TH")} ฿` : "—"} />
          <Stat label="เก็บแล้ว" value={`${collected.toLocaleString("th-TH")} ฿ (${paidCount}/${count})`} />
        </div>
      )}

      {editing && isAdmin && (
        <div className="border-t border-border/60 bg-secondary/30 p-4">
          <Label htmlFor="cost-input" className="mb-2 block text-xs">จำนวนเงินทั้งหมด (บาท)</Label>
          <div className="flex gap-2">
            <Input
              id="cost-input"
              type="number"
              min={0}
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              className="max-w-[200px]"
            />
            <Button size="sm" onClick={saveCost} disabled={savingCost}>
              {savingCost ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>ยกเลิก</Button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="border-t border-border/60 bg-secondary/20 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label className="text-xs">รูป QR Code สำหรับรับชำระ</Label>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                {uploadingQr ? "กำลังอัปโหลด..." : qrUrl ? "เปลี่ยนรูป" : "อัปโหลด QR"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingQr}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleQrFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {qrUrl && (
                <Button size="sm" variant="ghost" onClick={removeQr}>ลบ</Button>
              )}
            </div>
          </div>
          {qrUrl && (
            <img src={qrUrl} alt="QR code" className="mt-1 h-32 w-32 rounded-md border border-border object-contain bg-background" />
          )}
        </div>
      )}

      {count === 0 ? (
        <div className="border-t border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
          ยังไม่มีผู้เล่นในก๊วน
        </div>
      ) : total <= 0 ? (
        <div className="border-t border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
          ยังไม่ได้กำหนดยอดรวมของก๊วน
        </div>
      ) : (
        <ul className="divide-y divide-border border-t border-border/60">
          {sessionPlayerIds.map((pid) => {
            const p = playerMap.get(pid);
            if (!p) return null;
            const paid = paidMap.get(pid) ?? false;
            return (
              <li key={pid} className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setQrDialogFor(pid)}
                  className="min-w-0 flex-1 text-left transition hover:opacity-80"
                >
                  <div className="flex items-center gap-2">
                    <PlayerAvatar player={p} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-primary underline-offset-2 hover:underline">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ต้องจ่าย {perHead.toLocaleString("th-TH")} ฿
                        {isAdmin && minutesMap[pid] ? ` · เล่น ${minutesMap[pid]} นาที` : ""}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  {paid ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
                      <Check className="size-3" /> จ่ายแล้ว
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                      <Clock className="size-3" /> ค้างจ่าย
                    </span>
                  )}
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant={paid ? "outline" : "default"}
                      onClick={() => togglePaid(pid, !paid)}
                    >
                      {paid ? "ยกเลิก" : "บันทึกจ่าย"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!qrDialogFor} onOpenChange={(v) => !v && setQrDialogFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ชำระเงิน · {dialogPlayer?.name ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">จำนวนที่ต้องจ่าย</div>
              <div className="text-3xl font-extrabold tabular-nums text-primary">
                {perHead.toLocaleString("th-TH")} ฿
              </div>
              {qrDialogFor && (paidMap.get(qrDialogFor) ? (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
                  <Check className="size-3" /> จ่ายแล้ว
                </span>
              ) : (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                  <Clock className="size-3" /> ค้างจ่าย
                </span>
              ))}
            </div>
            {qrUrl ? (
              <img src={qrUrl} alt="QR code" className="h-64 w-64 rounded-lg border border-border object-contain bg-background" />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
                ยังไม่มี QR Code
                <br />สำหรับก๊วนนี้
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQrDialogFor(null)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}



function RosterEditor({
  sessionId,
  isAdmin,
  allPlayers,
  sessionPlayerIds,
  playerMap,
  playCount,
  minutesMap,
  onSaveMinutes,
  onChanged,
}: {
  sessionId: string;
  isAdmin: boolean;
  allPlayers: Player[];
  sessionPlayerIds: string[];
  playerMap: Map<string, Player>;
  playCount: Map<string, number>;
  minutesMap: Record<string, number>;
  onSaveMinutes: (playerId: string, value: number) => void;
  onChanged: () => void;
}) {
  const { pin } = useAdmin();
  const addFn = useServerFn(addSessionPlayer);
  const removeFn = useServerFn(removeSessionPlayer);
  const [adding, setAdding] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [quitFor, setQuitFor] = useState<string | null>(null);

  const idSet = new Set(sessionPlayerIds);
  const availableToAdd = allPlayers
    .filter((p) => !idSet.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleAdd = async (playerId: string) => {
    if (!pin || !playerId) return;
    setPendingId(playerId);
    try {
      await addFn({ data: { pin, session_id: sessionId, player_id: playerId } });
      toast.success("เพิ่มผู้เล่นแล้ว");
      onChanged();
      setAdding(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setPendingId(null);
    }
  };

  const handleRemove = async (playerId: string) => {
    if (!pin) return;
    const p = playerMap.get(playerId);
    if (!confirm(`เอา "${p?.name ?? "ผู้เล่น"}" ออกจากก๊วน?`)) return;
    setPendingId(playerId);
    try {
      await removeFn({ data: { pin, session_id: sessionId, player_id: playerId } });
      toast.success("ลบออกจากก๊วนแล้ว");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setPendingId(null);
    }
  };

  const quitPlayer = quitFor ? playerMap.get(quitFor) : null;

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">ผู้เล่นในก๊วน ({sessionPlayerIds.length})</div>
        {isAdmin && !adding && availableToAdd.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <UserPlus className="size-3.5" /> เพิ่มผู้เล่น
          </Button>
        )}
      </div>

      {sessionPlayerIds.length === 0 ? (
        <div className="text-xs text-muted-foreground">ยังไม่มีผู้เล่นในก๊วน</div>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto scroll-smooth rounded-xl border border-border divide-y divide-border">
          {sessionPlayerIds.map((pid) => {
            const p = playerMap.get(pid);
            if (!p) return null;
            const count = playCount.get(pid) ?? 0;
            return (
              <div key={pid} className="flex items-center gap-3 px-3 py-2">
                <PlayerAvatar player={p} size="md" />
                <Link
                  to="/players/$playerId"
                  params={{ playerId: p.id }}
                  className="min-w-0 flex-1 truncate text-base font-medium hover:underline"
                >
                  {p.name}
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 align-middle text-xs font-semibold tabular-nums text-muted-foreground">
                    <BarChart3 className="size-3.5" />
                    {count}
                  </span>
                  {isAdmin && minutesMap[pid] ? (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-accent/40 px-2 py-0.5 align-middle text-xs font-semibold tabular-nums">
                      {minutesMap[pid]} นาที
                    </span>
                  ) : null}
                </Link>
                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setQuitFor(pid)}
                      className="h-8"
                    >
                      <LogOut className="size-3.5" /> Quit Match!!
                    </Button>
                    <button
                      type="button"
                      disabled={pendingId === pid}
                      onClick={() => handleRemove(pid)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      title="เอาออกจากก๊วน"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && adding && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 p-2">
          <Select onValueChange={handleAdd}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="เลือกผู้เล่นที่จะเพิ่ม" />
            </SelectTrigger>
            <SelectContent>
              {availableToAdd.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {skillCode(p.skill_level)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>ยกเลิก</Button>
        </div>
      )}

      {quitFor && quitPlayer && (
        <QuitMatchDialog
          player={quitPlayer}
          initialMinutes={minutesMap[quitFor] ?? 120}
          onClose={() => setQuitFor(null)}
          onSave={(v) => {
            onSaveMinutes(quitFor, v);
            toast.success(`บันทึก ${v} นาทีของ ${quitPlayer.name} แล้ว`);
            setQuitFor(null);
          }}
        />
      )}
    </div>
  );
}

const MINUTE_OPTIONS = [30, 60, 90, 120] as const;

function QuitMatchDialog({
  player,
  initialMinutes,
  onClose,
  onSave,
}: {
  player: Player;
  initialMinutes: number;
  onClose: () => void;
  onSave: (minutes: number) => void;
}) {
  const isPreset = (MINUTE_OPTIONS as readonly number[]).includes(initialMinutes);
  const [mode, setMode] = useState<string>(isPreset ? String(initialMinutes) : "custom");
  const [customVal, setCustomVal] = useState<string>(isPreset ? "" : String(initialMinutes));

  const submit = () => {
    let v: number;
    if (mode === "custom") {
      v = Number(customVal);
      if (!Number.isFinite(v) || v <= 0) return toast.error("กรอกจำนวนนาทีให้ถูกต้อง");
    } else {
      v = Number(mode);
    }
    onSave(v);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quit Match · บันทึกจำนวนนาที</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3">
            <PlayerAvatar player={player} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-base font-bold">{player.name}</div>
              <div className="text-xs text-muted-foreground">เลือกหรือกรอกจำนวนนาทีที่เล่น</div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">จำนวนนาที</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="เลือกจำนวนนาที" />
              </SelectTrigger>
              <SelectContent>
                {MINUTE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} นาที{m === 120 ? " (Default)" : ""}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {mode === "custom" && (
              <Input
                type="number"
                min={1}
                value={customVal}
                onChange={(e) => setCustomVal(e.target.value)}
                placeholder="กรอกจำนวนนาที"
                className="h-10"
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


