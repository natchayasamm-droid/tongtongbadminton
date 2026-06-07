export type Player = {
  id: string;
  name: string;
  skill_level: number;
  created_at: string;
  avatar_url?: string | null;
};

export type SetScore = { a: number; b: number };

export type Match = {
  id: string;
  session_id: string | null;
  name: string | null;
  played_at: string;
  team_a_p1: string;
  team_a_p2: string;
  team_b_p1: string;
  team_b_p2: string;
  sets: SetScore[];
  winner_team: "A" | "B" | "tie" | null;
  status: string;
  notes: string | null;
  created_at: string;
};

export type Session = {
  id: string;
  name: string;
  played_at: string;
  notes: string | null;
  created_at: string;
  total_cost: number;
  qr_url?: string | null;
};

export type SessionPlayer = {
  session_id: string;
  player_id: string;
  paid: boolean;
};
