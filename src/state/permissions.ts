// Pure permission rules for editing another user's personal fields (no React, testable in node).
export type Tier = 'owner' | 'admin' | 'volunteer';
export const PROTECTED_FIELDS = ['firstName', 'middleNames', 'lastName', 'contact', 'email'] as const;

/** Only the owner, or the user themselves, may change names/contact/password. */
export function canEditPersonal(actor: { id: string; role: Tier } | null | undefined, targetId: string): boolean {
  return !!actor && (actor.role === 'owner' || actor.id === targetId);
}

/** Returns the protected field names that would change. Admin edits of others must leave these untouched. */
const norm = (k: string, v: any) => { const s = String(v ?? '').trim(); return k === 'email' ? s.toLowerCase() : s; };
export function changedProtected(before: Record<string, any>, p: Record<string, any>): string[] {
  return PROTECTED_FIELDS.filter(k => p[k] !== undefined && norm(k, p[k]) !== norm(k, before[k]));
}
