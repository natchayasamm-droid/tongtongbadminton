import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, ChevronRight, ExternalLink, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Player, Match } from "@/lib/types";
import { useAdmin } from "@/lib/admin-context";
import { createPlayer, deletePlayer, updatePlayer } from "@/lib/admin.functions";
import { SKILL_LEVELS, skillCode, skillLabel } from "@/lib/skill";
import { PlayerAvatar } from "@/components/player-avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/players")({
  head: () => ({
    meta: [
      { title: "ผู้เล่น — SmashLog" },
      { name: "description", content: "รายชื่อผู้เล่นพร้อมระดับฝีมือและสถิติชนะ-แพ้" },
    ],
  }),
  component: PlayersPage,
});

function PlayersPage() {
  const { isAdmin, pin } = useAdmin();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Player | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const playersQ = useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("skill_level", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as Player[];
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
  const matches = matchesQ.data ?? [];
  const filteredPlayers = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = (id: string) => {
    const ms = matches.filter((m) =>
      m.status === "completed" &&
      [m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2].includes(id),
    );
    const ties = ms.filter((m) => m.winner_team === "tie").length;
    const wins = ms.filter((m) => {
      const inA = m.team_a_p1 === id || m.team_a_p2 === id;
      return (inA && m.winner_team === "A") || (!inA && m.winner_team === "B");
    }).length;
    const losses = ms.length - wins - ties;
    return { total: ms.length, wins, losses, ties };
  };

  const [viewing, setViewing] = useState<Player | null>(null);

  const delFn = useServerFn(deletePlayer);

  const handleDelete = async (p: Player) => {
    if (!pin) return;
    if (!confirm(`ลบผู้เล่น "${p.name}" และแมตช์ที่เกี่ยวข้องทั้งหมด?`)) return;
    try {
      await delFn({ data: { pin, id: p.id } });
      toast.success("ลบผู้เล่นแล้ว");
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ผู้เล่น</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {players.length} คน · เรียงตามระดับฝีมือ
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> เพิ่มผู้เล่น
          </Button>
        )}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ค้นหาชื่อผู้เล่น..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {playersQ.isLoading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : players.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">ยังไม่มีผู้เล่น</p>
          {!isAdmin && (
            <p className="mt-2 text-xs text-muted-foreground">เข้าสู่โหมด Admin เพื่อเพิ่มผู้เล่น</p>
          )}
        </Card>
      ) : filteredPlayers.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">ไม่พบผู้เล่นที่ค้นหา</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlayers.map((p) => {
            const s = stats(p.id);
            const rate = s.total ? (s.wins / s.total) * 100 : 0;
            return (
              <Card key={p.id} className="group p-4 transition hover:shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setViewing(p)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <PlayerAvatar player={p} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-foreground hover:underline">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="mr-1 rounded bg-secondary px-1 py-0.5 text-[10px] font-bold text-primary">{skillCode(p.skill_level)}</span>
                        {s.total} แมตช์ · ชนะ {s.wins} / แพ้ {s.losses} / เสมอ {s.ties}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                  </button>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-[image:var(--gradient-accent)] transition-all"
                    style={{ width: `${rate}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">ชนะ {rate.toFixed(0)}%</span>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PlayerDialog open={open} onOpenChange={setOpen} editing={editing} />
      <PlayerStatsDialog
        player={viewing}
        stats={viewing ? stats(viewing.id) : null}
        onClose={() => setViewing(null)}
      />
    </main>
  );
}

function PlayerDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Player | null;
}) {
  const { pin } = useAdmin();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [level, setLevel] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const createFn = useServerFn(createPlayer);
  const updateFn = useServerFn(updatePlayer);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setLevel(editing?.skill_level ?? 0);
      setAvatarUrl(editing?.avatar_url ?? null);
    }
  }, [open, editing]);

  const handleClose = (v: boolean) => {
    if (!v) {
      setName("");
      setLevel(0);
      setAvatarUrl(null);
    }
    onOpenChange(v);
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ต้องไม่เกิน 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("อัปโหลดรูปแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setLoading(true);
    try {
      if (editing) {
        await updateFn({ data: { pin, id: editing.id, name, skill_level: level, avatar_url: avatarUrl } });
        toast.success("แก้ไขผู้เล่นแล้ว");
      } else {
        await createFn({ data: { pin, name, skill_level: level, avatar_url: avatarUrl } });
        toast.success("เพิ่มผู้เล่นแล้ว");
      }
      qc.invalidateQueries({ queryKey: ["players"] });
      handleClose(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "แก้ไขผู้เล่น" : "เพิ่มผู้เล่น"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-3">
            <PlayerAvatar player={{ name: name || "?", skill_level: level, avatar_url: avatarUrl }} size="xl" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="avatar-file">รูปผู้เล่น</Label>
              <Input
                id="avatar-file"
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {avatarUrl && (
                <button type="button" onClick={() => setAvatarUrl(null)} className="text-xs text-destructive hover:underline">
                  ลบรูป
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">ชื่อผู้เล่น</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
          </div>
          <div className="space-y-2">
            <Label>ระดับฝีมือ</Label>
            <Select value={String(level)} onValueChange={(v) => setLevel(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SKILL_LEVELS.map((s) => (
                  <SelectItem key={s.value} value={String(s.value)}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || uploading || !name.trim()}>
              {loading ? "กำลังบันทึก..." : uploading ? "กำลังอัปโหลด..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlayerStatsDialog({
  player,
  stats,
  onClose,
}: {
  player: Player | null;
  stats: { total: number; wins: number; losses: number; ties: number } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!player} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {player && stats && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>{player.name}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[160px_1fr] sm:items-center">
              <div className="flex justify-center sm:block">
                {player.avatar_url ? (
                  <img
                    src={player.avatar_url}
                    alt={player.name}
                    className="size-40 rounded-2xl object-cover ring-2 ring-border"
                  />
                ) : (
                  <PlayerAvatar player={player} size="xl" className="size-40 rounded-2xl" />
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold">{player.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <span className="mr-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {skillCode(player.skill_level)}
                    </span>
                    {skillLabel(player.skill_level)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <StatRow label="แมตซ์ทั้งหมด" value={stats.total} />
                  <StatRow label="ชนะ" value={stats.wins} tone="win" />
                  <StatRow label="แพ้" value={stats.losses} tone="loss" />
                  <StatRow label="เสมอ" value={stats.ties} />
                </div>
                <Link
                  to="/players/$playerId"
                  params={{ playerId: player.id }}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  onClick={onClose}
                >
                  ดูประวัติทั้งหมด <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatRow({ label, value, tone }: { label: string; value: number; tone?: "win" | "loss" }) {
  const color = tone === "win" ? "text-accent" : tone === "loss" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
      <div className="text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
