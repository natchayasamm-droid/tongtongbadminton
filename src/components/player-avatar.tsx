import type { Player } from "@/lib/types";
import { skillCode } from "@/lib/skill";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClass: Record<Size, string> = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-sm",
  xl: "size-16 text-xl",
};

export function PlayerAvatar({
  player,
  size = "md",
  className,
}: {
  player: Pick<Player, "name" | "skill_level" | "avatar_url"> | undefined;
  size?: Size;
  className?: string;
}) {
  if (!player) {
    return (
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-muted text-muted-foreground",
          sizeClass[size],
          className,
        )}
      >
        ?
      </span>
    );
  }
  if (player.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt={player.name}
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-background",
          sizeClass[size],
          className,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[image:var(--gradient-accent)] font-bold text-primary",
        sizeClass[size],
        className,
      )}
      title={player.name}
    >
      {skillCode(player.skill_level)}
    </span>
  );
}
