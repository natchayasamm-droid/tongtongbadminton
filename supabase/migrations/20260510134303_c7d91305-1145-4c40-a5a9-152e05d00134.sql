
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  skill_level SMALLINT NOT NULL DEFAULT 0 CHECK (skill_level >= 0 AND skill_level <= 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  team_a_p1 UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_a_p2 UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_b_p1 UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_b_p2 UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  sets JSONB NOT NULL DEFAULT '[]'::jsonb,
  winner_team TEXT NOT NULL CHECK (winner_team IN ('A','B')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_played_at ON public.matches(played_at DESC);
CREATE INDEX idx_matches_players ON public.matches(team_a_p1, team_a_p2, team_b_p1, team_b_p2);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public can view matches" ON public.matches FOR SELECT USING (true);
-- No insert/update/delete policies — only service role (via server functions) can write.
