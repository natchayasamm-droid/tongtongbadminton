import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  checkPin,
  createMatchSchema,
  idWithPinSchema,
  playerSchema,
  playerUpdateSchema,
  sessionSchema,
  sessionPlayerMutationSchema,
  updateScoreSchema,
  updateSessionCostSchema,
  updateSessionQrSchema,
  updatePaidSchema,
  updateMatchStatusSchema,
  supabaseAdmin,
} from "./admin.server";

export const verifyAdminPin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ pin: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    if (data.pin === "0409") {
    return {
      ok: true,
      message: "รหัสถูกต้อง"};
  } else {
    return {
      ok: false,
      message: "รหัสแอดมินไม่ถูกต้อง"};
    }
  });

export const createPlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => playerSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { data: row, error } = await supabaseAdmin
      .from("players")
      .insert({ name: data.name, skill_level: data.skill_level, avatar_url: data.avatar_url ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updatePlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => playerUpdateSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const patch: { name: string; skill_level: number; avatar_url?: string | null } = {
      name: data.name,
      skill_level: data.skill_level,
    };
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    const { error } = await supabaseAdmin
      .from("players")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idWithPinSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { error } = await supabaseAdmin.from("players").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sessionSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);



    const { data: session, error: sErr } = await supabaseAdmin
      .from("sessions")
      .insert({
        name: data.name,
        played_at: data.played_at,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (sErr) throw new Error(sErr.message);

    if (data.player_ids.length > 0) {
      const { error: spErr } = await supabaseAdmin
        .from("session_players")
        .insert(data.player_ids.map((pid) => ({ session_id: session.id, player_id: pid })));
      if (spErr) throw new Error(spErr.message);
    }

    return session;
  });

export const createMatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createMatchSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const ids = [data.team_a_p1, data.team_a_p2, data.team_b_p1, data.team_b_p2];
    if (new Set(ids).size !== 4) throw new Error("ผู้เล่นในคู่แข่งต้องไม่ซ้ำกัน");

    // validate players belong to session
    const { data: sps, error: spErr } = await supabaseAdmin
      .from("session_players")
      .select("player_id")
      .eq("session_id", data.session_id);
    if (spErr) throw new Error(spErr.message);
    const allowed = new Set((sps ?? []).map((x) => x.player_id));
    for (const id of ids) {
      if (!allowed.has(id)) throw new Error("ผู้เล่นในคู่แข่งต้องอยู่ในรายชื่อก๊วน");
    }

    const { data: session, error: sesErr } = await supabaseAdmin
      .from("sessions")
      .select("played_at")
      .eq("id", data.session_id)
      .single();
    if (sesErr) throw new Error(sesErr.message);

    const { data: row, error } = await supabaseAdmin
      .from("matches")
      .insert({
        session_id: data.session_id,
        name: data.name ?? null,
        played_at: session.played_at,
        team_a_p1: data.team_a_p1,
        team_a_p2: data.team_a_p2,
        team_b_p1: data.team_b_p1,
        team_b_p2: data.team_b_p2,
        sets: [{ a: 0, b: 0 }],
        status: "pending",
        winner_team: null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSession = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idWithPinSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { error } = await supabaseAdmin.from("sessions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMatchScore = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateScoreSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { error } = await supabaseAdmin
      .from("matches")
      .update({
        sets: data.sets,
        winner_team: data.winner_team,
        status: "completed",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMatch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => idWithPinSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { error } = await supabaseAdmin.from("matches").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSessionCost = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateSessionCostSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ total_cost: data.total_cost })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSessionQr = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateSessionQrSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ qr_url: data.qr_url })
      .eq("id", data.session_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateSessionPlayerPaid = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updatePaidSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { error } = await supabaseAdmin
      .from("session_players")
      .update({ paid: data.paid })
      .eq("session_id", data.session_id)
      .eq("player_id", data.player_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMatchStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateMatchStatusSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { error } = await supabaseAdmin
      .from("matches")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addSessionPlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sessionPlayerMutationSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    const { error } = await supabaseAdmin
      .from("session_players")
      .insert({ session_id: data.session_id, player_id: data.player_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSessionPlayer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => sessionPlayerMutationSchema.parse(d))
  .handler(async ({ data }) => {
    checkPin(data.pin);
    // Allow removing from roster; match history stays in matches table.
    const { error } = await supabaseAdmin
      .from("session_players")
      .delete()
      .eq("session_id", data.session_id)
      .eq("player_id", data.player_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
