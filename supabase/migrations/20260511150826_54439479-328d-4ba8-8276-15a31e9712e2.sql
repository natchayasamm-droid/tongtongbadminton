ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS total_cost numeric NOT NULL DEFAULT 0;
ALTER TABLE public.session_players ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;