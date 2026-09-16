import { redirect } from 'next/navigation';
import { getViewer, hasSession } from '@/lib/auth';
import SignOut from './SignOut';

export const metadata = { title: 'No access' };

/**
 * For someone who signed in successfully but has no profile - most likely a
 * Google account that nobody has been given access to.
 */
export default async function Page() {
  if (!(await hasSession())) redirect('/login');
  if (await getViewer()) redirect('/portal');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#f4f4f2',
        color: '#1d395b',
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 460, textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          You are signed in, but this account has no access.
        </h1>
        <p style={{ margin: '0 0 24px', lineHeight: 1.55, color: '#6b7280' }}>
          Customs Data Lock accounts are set up by our team - there is no self-signup. If you
          should have access, ask us to add this address.
        </p>
        <SignOut />
      </div>
    </div>
  );
}
