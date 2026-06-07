import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Users, Swords, Trophy, TrendingUp, ArrowRight, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Match } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { skillCode } from "@/lib/skill";
import { PlayerAvatar } from "@/components/player-avatar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "หน้าหลัก — SmashLog" },
      { name: "description", content: "ภาพรวมผู้เล่น แมตช์ล่าสุด และสถิติการแข่งแบดมินตันคู่" },
    ],
  }),
  component: Index,
});

function dayKey(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return format(dt, "yyyy-MM-dd");
}

function Index() {
  const playersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase.from("players").select("*").order("created_at");
      if (error) throw error;
      return data as Player[];
    },
  });
  const matchesQ = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .order("played_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Match[];
    },
  });

  const players = playersQ.data ?? [];
  const matches = matchesQ.data ?? [];
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Latest day with matches
  const latestDate = useMemo(() => {
    if (matches.length === 0) return undefined;
    return new Date(dayKey(matches[0].played_at));
  }, [matches]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const effectiveDate = selectedDate ?? latestDate;
  const dateKey = effectiveDate ? dayKey(effectiveDate) : undefined;
  const dayMatches = useMemo(() => {
    if (!dateKey) return [];
    const filtered = matches.filter((m) => dayKey(m.played_at) === dateKey);
    const num = (m: Match) => {
      const x = m.name?.match(/\d+/);
      return x ? parseInt(x[0], 10) : 0;
    };
    // Sort by match number desc (highest "คู่ที่ N" on top); fallback to created_at desc
    return [...filtered].sort((a, b) => {
      const d = num(b) - num(a);
      if (d !== 0) return d;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [matches, dateKey]);

  // Days that actually have matches — to highlight in calendar
  const matchDays = useMemo(
    () => Array.from(new Set(matches.map((m) => dayKey(m.played_at)))).map((k) => new Date(k)),
    [matches],
  );

  // Top winners
  const winRates = players
    .map((p) => {
      const ms = matches.filter((m) =>
        m.status === "completed" &&
        [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2].includes(p.id),
      );
      const wins = ms.filter((m) => {
        const inA = m.team_a_p1 === p.id || m.team_a_p2 === p.id;
        return (inA && m.winner_team === "A") || (!inA && m.winner_team === "B");
      }).length;
      return { player: p, total: ms.length, wins, rate: ms.length ? (wins / ms.length) * 100 : 0 };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.rate - a.rate || b.wins - a.wins)
    .slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl bg-[image:var(--gradient-hero)] p-8 text-primary-foreground shadow-[var(--shadow-card)] sm:p-12">
        <div className="max-w-2xl">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Trophy className="size-3.5" /> Badminton Doubles Tracker
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
            จัดการแมตช์แบดมินตันคู่
            <br />
            <span className="text-accent">ง่าย แม่น สนุก</span>
          </h1>
          <p className="mt-4 text-base text-white/80 sm:text-lg">
            เก็บข้อมูลผู้เล่น สุ่มจับคู่ตามระดับฝีมือ และดูสถิติการแข่งย้อนหลังได้ในที่เดียว
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/matches"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02]"
            >
              ไปที่แมตช์ <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/players"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold backdrop-blur hover:bg-white/10"
            >
              จัดการผู้เล่น
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard icon={<Users className="size-5" />} label="ผู้เล่น" value={players.length} />
        <StatCard icon={<Swords className="size-5" />} label="แมตช์ทั้งหมด" value={matches.length} />
        <StatCard
          icon={<TrendingUp className="size-5" />}
          label="แมตช์เดือนนี้"
          value={matches.filter((m) => new Date(m.played_at).getMonth() === new Date().getMonth()).length}
          className="col-span-2 md:col-span-1"
        />
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* Top winners */}
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Trophy className="size-5 text-accent" /> Top ชนะรัวๆ
          </h2>
          {winRates.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลแมตช์</p>
          ) : (
            <ol className="space-y-2">
              {winRates.map((s, i) => (
                <li
                  key={s.player.id}
                  className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <PlayerAvatar player={s.player} size="sm" />
                    <Link
                      to="/players/$playerId"
                      params={{ playerId: s.player.id }}
                      className="font-medium hover:underline"
                    >
                      {s.player.name}
                    </Link>
                    <span className="rounded bg-accent/30 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {skillCode(s.player.skill_level)}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-bold text-foreground">{s.rate.toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">
                      {s.wins}/{s.total} แมตช์
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Matches by day */}
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Swords className="size-5 text-accent" /> แมตช์ของวัน
            </h2>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("justify-start gap-2 text-left font-normal", !effectiveDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="size-4" />
                  {effectiveDate
                    ? effectiveDate.toLocaleDateString("th-TH", { dateStyle: "long" })
                    : "เลือกวันที่"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={effectiveDate}
                  onSelect={(d) => setSelectedDate(d ?? undefined)}
                  modifiers={{ hasMatch: matchDays }}
                  modifiersClassNames={{
                    hasMatch: "bg-accent/30 text-accent-foreground font-semibold",
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {dayMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {matches.length === 0 ? "ยังไม่มีแมตช์" : "ไม่มีแมตช์ในวันที่เลือก"}
            </p>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {dayMatches.map((m) => {
                const pa1 = playerMap.get(m.team_a_p1);
                const pa2 = playerMap.get(m.team_a_p2);
                const pb1 = playerMap.get(m.team_b_p1);
                const pb2 = playerMap.get(m.team_b_p2);
                const a1 = pa1?.name ?? "?";
                const a2 = pa2?.name ?? "?";
                const b1 = pb1?.name ?? "?";
                const b2 = pb2?.name ?? "?";
                const score = m.sets.map((s) => `${s.a}-${s.b}`).join(", ");
                const isDone = m.status === "completed";
                const hasScore = m.sets.some((s) => (s.a ?? 0) > 0 || (s.b ?? 0) > 0);
                const isOnGame = !isDone && (m.status === "in_progress" || hasScore);
                const aWin = isDone && m.winner_team === "A";
                const bWin = isDone && m.winner_team === "B";
                return (
                  <li key={m.id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground/80">{m.name ?? "—"}</span>
                      {isDone ? (
                        <span className="rounded bg-[oklch(0.92_0.08_150)] px-1.5 py-0.5 font-bold text-[oklch(0.32_0.12_150)]">
                          {m.winner_team === "tie" ? "เสมอ" : "เสร็จสิ้น"}
                        </span>
                      ) : isOnGame ? (
                        <span className="animate-pulse rounded bg-primary/10 px-1.5 py-0.5 font-extrabold text-primary">
                          On game!!!
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
                          Waiting
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1">
                      <div className={cn(aWin && "font-bold text-[oklch(0.45_0.17_150)]")}>
                        <div className="flex items-center gap-1.5">
                          <PlayerAvatar player={pa1} size="xs" />
                          <span>{a1}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <PlayerAvatar player={pa2} size="xs" />
                          <span>{a2}</span>
                        </div>
                      </div>
                      <div className="text-center text-xs">
                        {isDone && m.winner_team === "tie" ? (
                          <span className="font-bold text-muted-foreground">เสมอ</span>
                        ) : isDone ? (
                          <Trophy className="mx-auto size-4 text-accent" />
                        ) : (
                          <span className="text-muted-foreground">vs</span>
                        )}
                        {(isDone || hasScore) && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{score || "0-0"}</div>
                        )}
                      </div>
                      <div className={cn("text-right", bWin && "font-bold text-[oklch(0.45_0.17_150)]")}>
                        <div className="flex items-center justify-end gap-1.5">
                          <span>{b1}</span>
                          <PlayerAvatar player={pb1} size="xs" />
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1.5">
                          <span>{b2}</span>
                          <PlayerAvatar player={pb2} size="xs" />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card className={`flex items-center gap-4 p-5 ${className}`}>
      <div className="grid size-12 place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-primary">
        {icon}
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-3xl font-bold text-foreground">{value}</div>
      </div>
    </Card>
  );
}
