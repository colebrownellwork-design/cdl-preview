'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push('/login');
        router.refresh();
      }}
      style={{
        height: 42,
        padding: '0 20px',
        borderRadius: 999,
        border: '1px solid #e3e3df',
        background: '#fff',
        color: '#1d395b',
        fontSize: 14.5,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      Sign out
    </button>
  );
}
