import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../services/supabaseClient';

const FamilyContext = createContext(null);

const getErrorMessage = (error) => error?.message || 'Something went wrong. Please try again.';

export function FamilyProvider({ children }) {
  const { user, loading: authLoading, isLocalMode } = useAuth();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFamily = async () => {
    if (authLoading) return;
    if (!user || user.isLocal || isLocalMode || !supabase) {
      setFamily(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('family_members')
      .select('role, family:families(id, name, invite_code, created_by)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (queryError) {
      console.error('Could not load family:', queryError);
      setError(queryError.message);
      setFamily(null);
    } else if (data?.family) {
      setFamily({ ...data.family, role: data.role });
      const { data: memberData, error: memberError } = await supabase.rpc('get_family_members');
      if (memberError) console.error('Could not load family members:', memberError);
      setMembers((memberData || []).map((member) => ({
        ...member,
        display_name: member.username || 'Family member',
      })));
      setError('');
    } else {
      setFamily(null);
      setMembers([]);
      setError('');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFamily();
  }, [authLoading, user?.id, user?.isLocal, isLocalMode]);

  useEffect(() => {
    if (!family || !user || !supabase) return undefined;
    const membershipTimer = window.setInterval(async () => {
      const { data, error: membershipError } = await supabase
        .from('family_members')
        .select('family_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!membershipError && !data) {
        setFamily(null);
        setMembers([]);
        setError('You were removed from this family pantry.');
      }
    }, 10000);
    return () => window.clearInterval(membershipTimer);
  }, [family?.id, user?.id]);

  const createFamily = async (name) => {
    if (!supabase || !user) throw new Error('Please sign in first.');
    const { data, error: rpcError } = await supabase.rpc('create_family', { p_name: name.trim() });
    if (rpcError) throw new Error(getErrorMessage(rpcError));
    const created = Array.isArray(data) ? data[0] : data;
    setFamily(created);
    setError('');
    return created;
  };

  const joinFamily = async (inviteCode) => {
    if (!supabase || !user) throw new Error('Please sign in first.');
    const { data, error: rpcError } = await supabase.rpc('join_family', {
      p_invite_code: inviteCode.trim().toUpperCase(),
    });
    if (rpcError) throw new Error(getErrorMessage(rpcError));
    const joined = Array.isArray(data) ? data[0] : data;
    setFamily(joined);
    setError('');
    return joined;
  };

  const regenerateInviteCode = async () => {
    const { data, error: rpcError } = await supabase.rpc('regenerate_family_invite');
    if (rpcError) throw new Error(getErrorMessage(rpcError));
    setFamily((current) => ({ ...current, invite_code: data }));
    return data;
  };

  const leaveFamily = async () => {
    const { error: rpcError } = await supabase.rpc('leave_family');
    if (rpcError && !rpcError.message?.includes('leave_family')) {
      throw new Error(getErrorMessage(rpcError));
    }
    if (rpcError) {
      const { error: itemError } = await supabase
        .from('kitchen_items')
        .update({ family_id: null, updated_at: new Date().toISOString() })
        .eq('family_id', family.id)
        .eq('user_id', user.id);
      if (itemError) throw new Error(getErrorMessage(itemError));
      const { error: memberError } = await supabase
        .from('family_members')
        .delete()
        .eq('family_id', family.id)
        .eq('user_id', user.id);
      if (memberError) throw new Error(getErrorMessage(memberError));
    }
    setFamily(null);
    setMembers([]);
  };

  const removeMember = async (userId) => {
    const { error: rpcError } = await supabase.rpc('remove_family_member', { target_user_id: userId });
    const rpcMissing = rpcError?.message?.includes('Could not find the function')
      || rpcError?.message?.includes('schema cache')
      || rpcError?.code === 'PGRST202';
    if (rpcError && !rpcMissing) {
      throw new Error(getErrorMessage(rpcError));
    }
    if (rpcMissing) {
      const { data: removedMembers, error: memberError } = await supabase
        .from('family_members')
        .delete()
        .eq('family_id', family.id)
        .eq('user_id', userId)
        .select('user_id');
      if (memberError) throw new Error(getErrorMessage(memberError));
      if (!removedMembers?.length) {
        throw new Error('Kick was not applied. Run the family management SQL migration in Supabase first.');
      }
    }
    setMembers((current) => current.filter((member) => member.user_id !== userId));
  };

  const deleteFamily = async () => {
    const { error: rpcError } = await supabase.rpc('delete_family');
    if (rpcError) throw new Error(getErrorMessage(rpcError));
    setFamily(null);
    setMembers([]);
  };

  const value = {
    family,
    members,
    loading,
    error,
    createFamily,
    joinFamily,
    regenerateInviteCode,
    leaveFamily,
    removeMember,
    deleteFamily,
    refreshFamily: loadFamily,
  };

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const context = useContext(FamilyContext);
  if (!context) throw new Error('useFamily must be used within a FamilyProvider');
  return context;
}
