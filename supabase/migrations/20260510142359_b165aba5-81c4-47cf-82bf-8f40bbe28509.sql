
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  played_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view sessions"
  ON public.sessions FOR SELECT
  USING (true);

CREATE TABLE public.session_players (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, player_id)
);

ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view session_players"
  ON public.session_players FOR SELECT
  USING (true);

ALTER TABLE public.matches
  ADD COLUMN session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE public.matches
  ADD COLUMN status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.matches
  ALTER COLUMN winner_team DROP NOT NULL;

ALTER TABLE public.matches
  ALTER COLUMN sets SET DEFAULT '[]'::jsonb;

CREATE INDEX idx_matches_session ON public.matches(session_id);
CREATE INDEX idx_session_players_player ON public.session_players(player_id);
