import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Swords, Users, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Match, Session } from "@/lib/types";
import { skillLabel, skillCode } from "@/lib/skill";
import { PlayerAvatar } from "@/components/player-avatar";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/players/$playerId")({
  head: () => ({ meta: [{ title: "ผู้เล่น — SmashLog" }] }),
  component: PlayerDetail,
});

function PlayerDetail() {
  const { playerId } = Route.useParams();

  const playerQ = useQuery({
    queryKey: ["player", playerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").eq("id", playerId).single();
      if (error) throw error;
      return data as Player;
    },
  });

  const allPlayersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*");
      if (error) throw error;
      return data as Player[];
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sessions").select("*");
      if (error) throw error;
      return data as Session[];
    },
  });

  const matchesQ = useQuery({
    queryKey: ["matches", "of", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .or(
          `team_a_p1.eq.${playerId},team_a_p2.eq.${playerId},team_b_p1.eq.${playerId},team_b_p2.eq.${playerId}`,
        )
        .order("played_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Match[];
    },
  });

  const player = playerQ.data;
  const allMatches = matchesQ.data ?? [];
  const matches = allMatches.filter((m) => m.status === "completed");
  const playerMap = new Map((allPlayersQ.data ?? []).map((p) => [p.id, p]));
  const sessionMap = new Map((sessionsQ.data ?? []).map((s) => [s.id, s]));

  const wins = matches.filter((m) => {
    const inA = m.team_a_p1 === playerId || m.team_a_p2 === playerId;
    return (inA && m.winner_team === "A") || (!inA && m.winner_team === "B");
  }).length;
  const losses = matches.length - wins;
  const winRate = matches.length ? (wins / matches.length) * 100 : 0;

  const opponentTally = new Map<string, { wins: number; total: number }>();
  const partnerTally = new Map<string, { wins: number; total: number }>();
  for (const m of matches) {
    const inA = m.team_a_p1 === playerId || m.team_a_p2 === playerId;
    const opps = inA ? [m.team_b_p1, m.team_b_p2] : [m.team_a_p1, m.team_a_p2];
    const partner = inA
      ? m.team_a_p1 === playerId ? m.team_a_p2 : m.team_a_p1
      : m.team_b_p1 === playerId ? m.team_b_p2 : m.team_b_p1;
    const won = (inA && m.winner_team === "A") || (!inA && m.winner_team === "B");
    for (const o of opps) {
      const t = opponentTally.get(o) ?? { wins: 0, total: 0 };
      t.total++;
      if (won) t.wins++;
      opponentTally.set(o, t);
    }
    const pt = partnerTally.get(partner) ?? { wins: 0, total: 0 };
    pt.total++;
    if (won) pt.wins++;
    partnerTally.set(partner, pt);
  }

  if (playerQ.isLoading) return <main className="mx-auto max-w-4xl px-4 py-8">กำลังโหลด...</main>;
  if (!player) throw notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/players" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> กลับ
      </Link>

      <Card className="overflow-hidden p-0">
        <div className="bg-[image:var(--gradient-hero)] p-6 text-primary-foreground">
          <div className="flex items-center gap-4">
            <PlayerAvatar player={player} size="xl" className="ring-4 ring-white/30" />
            <div>
              <h1 className="text-2xl font-bold">{player.name}</h1>
              <p className="text-sm text-white/70">
                <span className="mr-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">{skillCode(player.skill_level)}</span>
                {skillLabel(player.skill_level)}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 p-6">
          <Stat label="ชนะ" value={`${winRate.toFixed(0)}%`} sub={`${wins} ครั้ง`} />
          <Stat label="แพ้" value={`${matches.length ? (100 - winRate).toFixed(0) : 0}%`} sub={`${losses} ครั้ง`} />
          <Stat label="แมตช์จบ" value={matches.length} sub={`รวม ${allMatches.length}`} />
        </div>
      </Card>

      <h2 className="mt-8 mb-3 flex items-center gap-2 text-lg font-bold">
        <Swords className="size-5 text-accent" /> ประวัติการแข่ง
      </h2>
      {allMatches.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">ยังไม่มีแมตช์</Card>
      ) : (
        <ul className="space-y-2">
          {allMatches.map((m) => {
            const inA = m.team_a_p1 === playerId || m.team_a_p2 === playerId;
            const isDone = m.status === "completed";
            const won = isDone && ((inA && m.winner_team === "A") || (!inA && m.winner_team === "B"));
            const partnerId = inA
              ? m.team_a_p1 === playerId ? m.team_a_p2 : m.team_a_p1
              : m.team_b_p1 === playerId ? m.team_b_p2 : m.team_b_p1;
            const oppIds = inA ? [m.team_b_p1, m.team_b_p2] : [m.team_a_p1, m.team_a_p2];
            const sess = m.session_id ? sessionMap.get(m.session_id) : undefined;
            return (
              <Card key={m.id} className="flex items-center gap-3 p-4">
                <span className={`grid size-12 shrink-0 place-items-center rounded-xl font-bold ${
                  !isDone ? "bg-muted text-muted-foreground"
                  : won ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"
                }`}>
                  {!isDone ? <Clock className="size-5" /> : won ? "W" : "L"}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(m.played_at).toLocaleDateString("th-TH", { dateStyle: "medium" })}</span>
                    {sess && (
                      <Link to="/sessions/$sessionId" params={{ sessionId: sess.id }} className="truncate text-accent hover:underline">
                        · {sess.name}
                      </Link>
                    )}
                  </div>
                  <div className="font-medium">คู่กับ {playerMap.get(partnerId)?.name ?? "?"}</div>
                  <div className="text-xs text-muted-foreground">
                    เจอ {oppIds.map((id) => playerMap.get(id)?.name ?? "?").join(" & ")}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {isDone ? (
                    m.sets.map((s, i) => <div key={i}>{inA ? `${s.a}-${s.b}` : `${s.b}-${s.a}`}</div>)
                  ) : (
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold">รอแข่ง</span>
                  )}
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      {partnerTally.size > 0 && (
        <>
          <h2 className="mt-8 mb-3 flex items-center gap-2 text-lg font-bold">
            <Users className="size-5 text-accent" /> เคยจับคู่กับ
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...partnerTally.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .map(([pid, t]) => (
                <Card key={pid} className="flex items-center justify-between p-3 text-sm">
                  <Link to="/players/$playerId" params={{ playerId: pid }} className="font-medium hover:underline">
                    {playerMap.get(pid)?.name ?? "?"}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    <CheckCircle2 className="-mt-0.5 mr-1 inline size-3 text-accent" />
                    ชนะด้วยกัน {t.wins}/{t.total} ({((t.wins / t.total) * 100).toFixed(0)}%)
                  </span>
                </Card>
              ))}
          </div>
        </>
      )}

      {opponentTally.size > 0 && (
        <>
          <h2 className="mt-8 mb-3 flex items-center gap-2 text-lg font-bold">
            <Trophy className="size-5 text-accent" /> สถิติเจอคู่ต่อสู้
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...opponentTally.entries()]
              .sort((a, b) => b[1].total - a[1].total)
              .map(([oid, t]) => (
                <Card key={oid} className="flex items-center justify-between p-3 text-sm">
                  <Link to="/players/$playerId" params={{ playerId: oid }} className="font-medium hover:underline">
                    {playerMap.get(oid)?.name ?? "?"}
                  </Link>
                  <span className="text-muted-foreground">
                    ชนะ {t.wins}/{t.total} ({((t.wins / t.total) * 100).toFixed(0)}%)
                  </span>
                </Card>
              ))}
          </div>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="text-center">
      <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
