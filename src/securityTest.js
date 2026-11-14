
import { supabase } from './supabase';

export async function testFolderPrivacy(folderId) {
  if (!supabase) {
    console.error('Supabase is not configured');
    return;
  }

  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) {
    console.error('Please sign in first');
    return;
  }

  console.log('Testing with Account B');

  // Test 1: Attempt to read Account A's folder
  const { data: folders, error: readError } =
    await supabase
      .from('folders')
      .select('id, name')
      .eq('id', folderId);

  const readBlocked = !readError && folders.length === 0;

  // Test 2: Attempt to update Account A's folder
  // Uses a harmless name change; RLS should prevent it.
  const { data: updated, error: updateError } =
    await supabase
      .from('folders')
      .update({ name: 'Unauthorized Test' })
      .eq('id', folderId)
      .select('id');

  const updateBlocked =
    !updateError && updated.length === 0;

  console.table([
    {
      test: 'Read another user folder',
      passed: readBlocked,
      error: readError?.message ?? ''
    },
    {
      test: 'Update another user folder',
      passed: updateBlocked,
      error: updateError?.message ?? ''
    }
  ]);
}
