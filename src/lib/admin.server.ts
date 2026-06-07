import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function checkPin(pin: string) {
  const expected = process.env.ADMIN_PIN;
  if (!expected) throw new Error("Admin PIN ยังไม่ได้ตั้งค่า");
  if (pin !== expected) throw new Error("รหัส Admin ไม่ถูกต้อง");
}

export const playerSchema = z.object({
  pin: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  skill_level: z.number().int().min(0).max(4),
  avatar_url: z.string().url().max(500).optional().nullable(),
});

export const playerUpdateSchema = playerSchema.extend({ id: z.string().uuid() });

export const idWithPinSchema = z.object({ pin: z.string(), id: z.string().uuid() });

export const sessionPlayerMutationSchema = z.object({
  pin: z.string().min(1).max(64),
  session_id: z.string().uuid(),
  player_id: z.string().uuid(),
});

const pairingSchema = z.object({
  name: z.string().trim().max(80).optional().nullable(),
  team_a_p1: z.string().uuid(),
  team_a_p2: z.string().uuid(),
  team_b_p1: z.string().uuid(),
  team_b_p2: z.string().uuid(),
});

export const sessionSchema = z.object({
  pin: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  played_at: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
  player_ids: z.array(z.string().uuid()).min(1).max(40),
});

export const createMatchSchema = z.object({
  pin: z.string().min(1).max(64),
  session_id: z.string().uuid(),
  name: z.string().trim().max(80).optional().nullable(),
  team_a_p1: z.string().uuid(),
  team_a_p2: z.string().uuid(),
  team_b_p1: z.string().uuid(),
  team_b_p2: z.string().uuid(),
});

export const updateSessionCostSchema = z.object({
  pin: z.string().min(1).max(64),
  session_id: z.string().uuid(),
  total_cost: z.number().min(0).max(1000000),
});

export const updateSessionQrSchema = z.object({
  pin: z.string().min(1).max(64),
  session_id: z.string().uuid(),
  qr_url: z.string().url().max(500).nullable(),
});

export const updatePaidSchema = z.object({
  pin: z.string().min(1).max(64),
  session_id: z.string().uuid(),
  player_id: z.string().uuid(),
  paid: z.boolean(),
});

export const updateMatchStatusSchema = z.object({
  pin: z.string().min(1).max(64),
  id: z.string().uuid(),
  status: z.enum(["pending", "in_progress"]),
});

export const updateScoreSchema = z.object({
  pin: z.string().min(1).max(64),
  id: z.string().uuid(),
  sets: z
    .array(z.object({ a: z.number().int().min(0).max(99), b: z.number().int().min(0).max(99) }))
    .max(5)
    .default([]),
  winner_team: z.enum(["A", "B", "tie"]),
});

export { supabaseAdmin };
