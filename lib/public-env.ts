export const publicEnv = {
  nextPublicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  nextPublicSupabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

export function hasSupabaseEnv() {
  return Boolean(
    publicEnv.nextPublicSupabaseUrl &&
    publicEnv.nextPublicSupabaseAnonKey,
  );
}
