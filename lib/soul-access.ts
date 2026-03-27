export function soulMatchesWorld(soulWorldId: string | null | undefined, requestWorldId: string) {
  return Boolean(soulWorldId) && soulWorldId === requestWorldId;
}
