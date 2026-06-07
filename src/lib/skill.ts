export const SKILL_LEVELS = [
  { value: 0, code: "BB", label: "BB · เริ่มต้น" },
  { value: 1, code: "BG", label: "BG · พื้นฐาน" },
  { value: 2, code: "N", label: "N · กลาง" },
  { value: 3, code: "P", label: "P · ดี" },
  { value: 4, code: "S", label: "S · เก่งมาก" },
] as const;

export function skillCode(v: number) {
  return SKILL_LEVELS.find((s) => s.value === v)?.code ?? "?";
}
export function skillLabel(v: number) {
  return SKILL_LEVELS.find((s) => s.value === v)?.label ?? "—";
}
