import { supabase } from './supabase';

export type FamilyRole = 'Admin' | 'Contributor' | 'Dependent';

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: FamilyRole;
  joined_at: string;
  full_name: string | null;
}

// Fetch the family the user belongs to, together with its full member roster.
// Returns null when the user is not part of any family.
export async function fetchUserFamily(
  userId: string
): Promise<{ family: Family; members: FamilyMember[] } | null> {
  const { data, error } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const { data: family, error: familyError } = await supabase
    .from('families')
    .select('*')
    .eq('id', data.family_id)
    .single();

  if (familyError) {
    throw familyError;
  }

  const members = await fetchFamilyMembers(family.id);
  return { family: family as Family, members };
}

// Roster of a family, enriched with each member's display name from profiles.
// Uses the get_family_roster RPC (security definer) so names resolve even when
// profiles RLS hides other members' rows; falls back to a direct query if the
// RPC has not been deployed yet.
export async function fetchFamilyMembers(familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase.rpc('get_family_roster', {
    p_family_id: familyId,
  });

  if (error) {
    console.warn('get_family_roster failed, falling back to direct query:', error.message);
    return fetchFamilyMembersDirect(familyId);
  }

  return (data ?? []) as FamilyMember[];
}

async function fetchFamilyMembersDirect(familyId: string): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('family_id', familyId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw error;
  }

  const members = (data ?? []) as FamilyMember[];
  if (members.length === 0) {
    return members;
  }

  const userIds = members.map((m) => m.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);

  if (profilesError) {
    throw profilesError;
  }

  const nameByUserId = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return members.map((m) => ({ ...m, full_name: nameByUserId.get(m.user_id) ?? null }));
}

export async function createFamily(name: string): Promise<Family> {
  const { data, error } = await supabase.rpc('create_family', { p_name: name });
  if (error) {
    throw error;
  }
  return data as Family;
}

export async function joinFamilyByCode(code: string): Promise<Family> {
  const { data, error } = await supabase.rpc('join_family', { p_invite_code: code });
  if (error) {
    throw error;
  }
  return data as Family;
}
