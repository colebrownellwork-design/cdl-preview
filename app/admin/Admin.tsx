'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Viewer } from '@/lib/auth';
import { fmtDate, fmtDay, initials, PLAN_LABEL } from '@/lib/format';
import { IconHome, IconDoc, IconUser, IconOut, IconMail, IconPlus, IconTrash } from '@/app/_components/icons';
import AccountDetail from './AccountDetail';

type Account = {
  id: string; name: string; plan: string | null; status: string;
  protected_since: string | null; next_check_on: string | null;
  renewal_on: string | null; renewal_is_automatic: boolean; stripe_customer_id: string | null;
};
type Check = {
  id: string; company: string; contact_name: string; job_title: string | null; email: string;
  reason: string | null; reason_other: string | null; other_names: string | null;
  plan_hint: string | null; status: 'new' | 'in_review' | 'sent'; notes: string | null;
  account_id: string | null; submitted_at: string;
};
type EntityName = { id: string; name: string; status: string };
type Entity = {
  id: string; account_id: string; legal_name: string; status: string;
  protected_since: string | null; entity_names: EntityName[];
};
type Recipient = { id: string; account_id: string; name: string | null; email: string };
type Platform = { id: string; slug: string; name: string; is_active: boolean };
type Staff = { id: string; email: string; full_name: string | null; role: string };
type Run = { id: string; account_id: string; period: string; due_on: string; status: string; new_names_found: number };

const VIEWS = ['overview', 'accounts', 'checks', 'monitoring', 'renewals', 'team', 'settings'] as const;
type View = (typeof VIEWS)[number];
const LABEL: Record<View, string> = {
  overview: 'Overview', accounts: 'Accounts', checks: 'Exposure checks',
  monitoring: 'Monitoring', renewals: 'Renewals', team: 'Team', settings: 'Settings',
};

const REASON_LABEL: Record<string, string> = {
  competitor: 'Competitor concern', launch: 'New product launch',
  negotiation: 'Negotiation coming up', fraud: 'Suspicious invoice',
  lapsed: 'Protection lapsed', broker: 'Broker or counsel', curious: 'Curious', other: 'Other',
};

const STATUS_TAG: Record<string, string> = {
  new: 'coral', in_review: 'amber', sent: 'green',
  lead: 'amber', quote_sent: 'amber', protected: 'green', renewal_due: 'coral', lapsed: 'coral',
};

export default function Admin({
  viewer, accounts, checks, entities, platforms, staff, runs, reportsThisMonth, recipients,
}: {
  viewer: Viewer; accounts: Account[]; checks: Check[]; entities: Entity[];
  platforms: Platform[]; staff: Staff[]; runs: Run[];
  reportsThisMonth: { id: string; sent_at: string | null }[]; recipients: Recipient[];
}) {
  const router = useRouter();
  const db = supabaseBrowser();
  const [view, setView] = useState<View>('overview');
  const [error, setError] = useState('');
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);

  /** Runs a write, surfaces failure, and re-reads from the server. */
  async function run(label: string, fn: () => Promise<{ error: { message: string } | null }>) {
    setError('');
    const { error } = await fn();
    if (error) return setError(`${label}: ${error.message}`);
    router.refresh();
  }

  async function addStaff(email: string) {
    setError('');
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? 'Could not add them.');
    router.refresh();
  }

  async function removeStaff(email: string) {
    setError('');
    const res = await fetch(`/api/admin/staff?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? 'Could not remove them.');
    router.refresh();
  }

  /** One run per protected account for this month, skipping any already made. */
  async function generateRuns() {
    setError('');
    const period = new Date();
    period.setDate(1);
    const periodIso = period.toISOString().slice(0, 10);

    const due = new Date(period);
    due.setDate(5);
    const dueIso = due.toISOString().slice(0, 10);

    const already = new Set(runs.filter((r) => r.period === periodIso).map((r) => r.account_id));
    const rows = accounts
      .filter((a) => a.status === 'protected' && !already.has(a.id))
      .map((a) => ({ account_id: a.id, period: periodIso, due_on: dueIso, status: 'scheduled' }));

    if (!rows.length) return setError('Every protected account already has a run for this month.');
    await run('Could not create the runs', async () => db.from('monitoring_runs').insert(rows));
  }

  async function newAccount() {
    setError('');
    const { data, error } = await db
      .from('accounts')
      .insert({ name: 'New account', status: 'lead' })
      .select('id')
      .single();
    if (error) return setError(`Could not create the account: ${error.message}`);
    setOpenAccountId(data.id);
    go('accounts');
    router.refresh();
  }

  useEffect(() => {
    const sync = () => {
      const v = location.hash.slice(1) as View;
      setView(VIEWS.includes(v) ? v : 'overview');
    };
    sync();
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);

  const go = (v: View) => {
    history.replaceState(null, '', `#${v}`);
    setView(v);
  };

  const openChecks = checks.filter((c) => c.status !== 'sent');
  const byAccount = useMemo(() => {
    const m = new Map<string, { entities: number; names: number }>();
    for (const e of entities) {
      const cur = m.get(e.account_id) ?? { entities: 0, names: 0 };
      m.set(e.account_id, { entities: cur.entities + 1, names: cur.names + e.entity_names.length });
    }
    return m;
  }, [entities]);

  const openAccount = accounts.find((a) => a.id === openAccountId) ?? null;

  const soon = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const renewals = accounts
    .filter((a) => a.renewal_on && a.renewal_on <= soon)
    .sort((a, b) => (a.renewal_on! < b.renewal_on! ? -1 : 1));

  return (
    <div className="app">
      <aside className="side">
        <div className="logo">
          <a href="/"><img src="/logo/official/cdl-logo-dark-for-light-bg.png" alt="Customs Data Lock" /></a>
        </div>
        <div className="who">Admin</div>
        <nav>
          {VIEWS.map((v) => (
            <a key={v} href={`#${v}`} className={view === v ? 'on' : undefined}
              onClick={(e) => { e.preventDefault(); go(v); }}>
              {v === 'overview' ? <IconHome /> : v === 'team' ? <IconUser /> : <IconDoc />}
              {LABEL[v]}
              {v === 'checks' && openChecks.length > 0 && <span className="b">{openChecks.length}</span>}
            </a>
          ))}
        </nav>
        <div className="key">
          <h5>Key</h5>
          <div><i className="dot coral" /><b>Needs action</b><span>New, overdue, or failing</span></div>
          <div><i className="dot amber" /><b>In progress</b><span>Started, or waiting on the customer</span></div>
          <div><i className="dot indigo" /><b>Scheduled</b><span>Automatic, nothing to do</span></div>
          <div><i className="dot green" /><b>Done</b><span>Sent or completed</span></div>
        </div>
        <div className="acct">
          <span className="av" style={{ background: 'var(--coral)' }}>
            {initials(viewer.full_name ?? viewer.email)}
          </span>
          <div>
            <b>{viewer.full_name ?? viewer.email}</b>
            <span>{viewer.role === 'admin' ? 'Admin' : 'Staff'}</span>
          </div>
          <a className="out" href="/login" title="Log out"
            onClick={async (e) => { e.preventDefault(); await db.auth.signOut(); router.push('/login'); }}>
            <IconOut />
          </a>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumb"><b>Admin</b> / <span>{LABEL[view]}</span></div>
        </div>

        {error && <p role="alert" style={{ margin: '0 0 16px', color: '#B42318', fontSize: 14 }}>{error}</p>}

        {view === 'overview' && (
          <section className="view">
            <div className="head">
              <div>
                <h1 className="h1">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}.</h1>
                <p className="sub">
                  {openChecks.length} exposure {openChecks.length === 1 ? 'check is' : 'checks are'} waiting.{' '}
                  {runs.filter((r) => r.status !== 'done').length} monitoring reports still to send this month.
                </p>
              </div>
            </div>
            <div className="grid g4 mb">
              <Kpi label="Active accounts" value={accounts.filter((a) => a.status === 'protected').length} />
              <Kpi label="Exposure checks waiting" value={openChecks.length} coral={openChecks.length > 0} />
              <Kpi label="Reports this month" value={reportsThisMonth.filter((r) => r.sent_at).length}
                small={`of ${reportsThisMonth.length} sent`} />
              <Kpi label="Renewals in 60 days" value={renewals.length}
                small={renewals.every((r) => r.renewal_is_automatic) ? 'all automatic' : 'some need a person'} />
            </div>
            <div className="card">
              <h3>
                Exposure checks{' '}
                <a href="#checks" onClick={(e) => { e.preventDefault(); go('checks'); }}>Queue</a>
              </h3>
              <CheckTable checks={checks.slice(0, 8)} onOpen={() => go('checks')} />
            </div>
          </section>
        )}

        {view === 'accounts' && (
          <section className="view">
            <div className="head">
              <div>
                <h1 className="h1">Accounts</h1>
                <p className="sub">
                  {accounts.length} accounts · {accounts.filter((a) => a.status === 'protected').length} protected ·{' '}
                  {accounts.filter((a) => a.status === 'quote_sent').length} quotes out ·{' '}
                  {accounts.filter((a) => a.status === 'renewal_due').length} renewals due. Click a row to open it.
                </p>
              </div>
              <button className="pill pill-coral pill-sm" type="button" onClick={newAccount}>
                <IconPlus size={16} /> New account
              </button>
            </div>

            <div className="card mb">
              <table>
                <tbody>
                  <tr>
                    <th>Company</th><th>Plan</th><th>Entities</th><th>Names</th>
                    <th>Next check</th><th>Renewal</th><th>Status</th>
                  </tr>
                  {accounts.map((a) => {
                    const counts = byAccount.get(a.id) ?? { entities: 0, names: 0 };
                    return (
                      <tr
                        key={a.id}
                        className={`sel${openAccountId === a.id ? ' on' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setOpenAccountId(openAccountId === a.id ? null : a.id)}
                      >
                        <td>
                          <div className="row">
                            <span className="mg sm" style={{ '--c': '#1D395B' } as React.CSSProperties}>{initials(a.name)}</span>
                            <b>{a.name}</b>
                          </div>
                        </td>
                        <td className="m">{a.plan ? PLAN_LABEL[a.plan] : '—'}</td>
                        <td className="m">{counts.entities || '—'}</td>
                        <td className="m">{counts.names || '—'}</td>
                        <td className="m">{fmtDay(a.next_check_on) || '—'}</td>
                        <td className="m">{fmtDate(a.renewal_on) || '—'}</td>
                        <td><span className={`tag ${STATUS_TAG[a.status] ?? 'mute'}`}>{niceStatus(a.status)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!accounts.length && <p className="note">No accounts yet. Start one with New account, or send a quote from the check queue.</p>}
            </div>

            {openAccount && (
              <AccountDetail
                account={openAccount}
                entities={entities.filter((e) => e.account_id === openAccount.id)}
                recipients={recipients.filter((r) => r.account_id === openAccount.id)}
                onChanged={() => router.refresh()}
                onClose={() => setOpenAccountId(null)}
                onError={setError}
              />
            )}
          </section>
        )}

        {view === 'checks' && (
          <ChecksView checks={checks} setError={setError} onChanged={() => router.refresh()} />
        )}

        {view === 'monitoring' && (
          <section className="view">
            <div className="head">
              <div>
                <h1 className="h1">Monitoring</h1>
                <p className="sub">
                  Every protected account is checked once a month across{' '}
                  {platforms.filter((p) => p.is_active).length} entries, and the report goes out the same day.
                </p>
              </div>
              <button className="pill pill-coral pill-sm" type="button" onClick={generateRuns}>
                <IconPlus size={16} /> Create this month&rsquo;s runs
              </button>
            </div>
            <div className="card">
              <h3>Due</h3>
              {runs.filter((r) => r.status !== 'done').length ? (
                <table>
                  <tbody>
                    <tr><th>Account</th><th>Period</th><th>Due</th><th>Status</th><th className="r" /></tr>
                    {runs.filter((r) => r.status !== 'done').map((r) => (
                      <tr key={r.id}>
                        <td><b>{accounts.find((a) => a.id === r.account_id)?.name ?? '—'}</b></td>
                        <td className="m">{fmtDate(r.period)}</td>
                        <td className="m">{fmtDate(r.due_on)}</td>
                        <td><span className="tag amber">{r.status.replace('_', ' ')}</span></td>
                        <td className="r">
                          <a className="lnk" style={{ cursor: 'pointer' }}
                            onClick={() => run('Could not close the run', async () =>
                              db.from('monitoring_runs')
                                .update({ status: 'done', completed_at: new Date().toISOString() })
                                .eq('id', r.id))}>
                            Mark done
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="note">
                  Nothing scheduled. Use &ldquo;Create this month&rsquo;s runs&rdquo; above - there is no
                  job doing it automatically yet, so it is a monthly click for now.
                </p>
              )}
            </div>
          </section>
        )}

        {view === 'renewals' && (
          <section className="view">
            <div className="head">
              <div>
                <h1 className="h1">Renewals</h1>
                <p className="sub">What renews when, and whether anything needs a person.</p>
              </div>
            </div>
            <div className="grid g4 mb">
              <Kpi label="Renewing in 60 days" value={renewals.length} />
              <Kpi label="Automatic, card on file" value={renewals.filter((r) => r.renewal_is_automatic && r.stripe_customer_id).length} />
              <Kpi label="Need a person" value={renewals.filter((r) => !r.renewal_is_automatic || !r.stripe_customer_id).length}
                coral={renewals.some((r) => !r.stripe_customer_id)} />
            </div>
            <div className="card">
              <table>
                <tbody>
                  <tr><th>Account</th><th>Plan</th><th>Renews</th><th>How</th></tr>
                  {renewals.map((a) => (
                    <tr key={a.id}>
                      <td><b>{a.name}</b></td>
                      <td className="m">{a.plan ? PLAN_LABEL[a.plan] : '—'}</td>
                      <td className="m">{fmtDate(a.renewal_on)}</td>
                      <td>
                        {a.renewal_is_automatic && a.stripe_customer_id
                          ? <span className="tag green">Automatic</span>
                          : <span className="tag coral">Needs a person</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!renewals.length && <p className="note">Nothing renewing in the next 60 days.</p>}
            </div>
          </section>
        )}

        {view === 'team' && (
          <section className="view">
            <div className="head">
              <div><h1 className="h1">Team</h1><p className="sub">Who can see this console. Everyone here sees every account.</p></div>
            </div>
            <div className="card">
              {staff.map((s2) => (
                <div className="setrow" key={s2.id}>
                  <div className="row">
                    <span className="av sm">{initials(s2.full_name ?? s2.email)}</span>
                    <div><b>{s2.full_name ?? s2.email}</b><span className="s">{s2.email}</span></div>
                  </div>
                  <div className="row">
                    <span className="tag mute">{s2.role === 'admin' ? 'Admin' : 'Staff'}</span>
                    {s2.id !== viewer.id && (
                      <span
                        className="del"
                        style={{ cursor: 'pointer' }}
                        title="Remove access"
                        onClick={() => removeStaff(s2.email)}
                      >
                        <IconTrash />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <AdminAddRow
                label="Give someone access"
                placeholder="name@customsdatalock.com, then Enter"
                onAdd={addStaff}
              />
              <p className="note">
                They sign in with Google, or set a password with
                {' '}<span className="mono">scripts/set-password.sh</span>. Access is all or nothing:
                staff and admin currently see exactly the same things.
              </p>
            </div>
          </section>
        )}

        {view === 'settings' && (
          <section className="view">
            <div className="head">
              <div><h1 className="h1">Settings</h1><p className="sub">What a monthly check covers.</p></div>
            </div>
            <div className="card">
              <h3>Checked each month <span className="m2">{platforms.filter((p) => p.is_active).length} active</span></h3>
              {platforms.map((p) => (
                <div className="setrow" key={p.id}>
                  <div><b>{p.name}</b><span className="s">{p.slug}</span></div>
                  <div className="row">
                    <span
                      className={`tag ${p.is_active ? 'green' : 'mute'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => run('Could not update', async () =>
                        db.from('platforms').update({ is_active: !p.is_active }).eq('id', p.id))}
                    >
                      {p.is_active ? 'Checked' : 'Off'}
                    </span>
                    <span
                      className="del"
                      style={{ cursor: 'pointer' }}
                      onClick={() => run('Could not remove', async () =>
                        db.from('platforms').delete().eq('id', p.id))}
                    >
                      <IconTrash />
                    </span>
                  </div>
                </div>
              ))}
              <AdminAddRow
                label="Add something to the list"
                placeholder="Name, then Enter"
                onAdd={(name) => run('Could not add', async () =>
                  db.from('platforms').insert({
                    name,
                    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                    sort: (platforms.length + 1) * 10,
                  }))}
              />
              <p className="note">
                An entry is one thing a run ticks off - a trade platform, the same data resold
                under another organizational structure, or a viewpoint on how a company appears.
                &ldquo;18 platforms&rdquo; on the public site is the simplification of this list.
              </p>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

const niceStatus = (s: string) =>
  ({ quote_sent: 'Quote sent', renewal_due: 'Renewal due', in_review: 'In review' })[s] ??
  s.charAt(0).toUpperCase() + s.slice(1);

function Kpi({ label, value, small, coral }: { label: string; value: number; small?: string; coral?: boolean }) {
  return (
    <div className="card kpi">
      <span className="l">{label}</span>
      <div className="n" style={coral ? { color: 'var(--coral)' } : undefined}>
        {value}
        {small && <small>{small}</small>}
      </div>
    </div>
  );
}

function CheckTable({ checks, onOpen, selectedId }: {
  checks: Check[]; onOpen: (c: Check) => void; selectedId?: string;
}) {
  if (!checks.length) return <p className="note">Nothing waiting.</p>;
  return (
    <table>
      <tbody>
        <tr><th>Company</th><th>Contact</th><th>Submitted</th><th>Reason</th><th>Status</th></tr>
        {checks.map((c) => (
          <tr key={c.id} className={`sel${selectedId === c.id ? ' on' : ''}`} onClick={() => onOpen(c)}
            style={{ cursor: 'pointer' }}>
            <td>
              <div className="row">
                <span className="mg sm" style={{ '--c': '#B45309' } as React.CSSProperties}>{initials(c.company)}</span>
                <b>{c.company}</b>
              </div>
            </td>
            <td className="m">{c.contact_name}{c.job_title ? ` · ${c.job_title}` : ''}</td>
            <td className="m">{fmtDate(c.submitted_at)}</td>
            <td className="m">{c.reason ? (REASON_LABEL[c.reason] ?? c.reason) : '—'}</td>
            <td><span className={`tag ${STATUS_TAG[c.status]}`}>{niceStatus(c.status)}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChecksView({ checks, setError, onChanged }: {
  checks: Check[]; setError: (s: string) => void; onChanged: () => void;
}) {
  const db = supabaseBrowser();
  const [selectedId, setSelectedId] = useState(checks.find((c) => c.status !== 'sent')?.id ?? checks[0]?.id);
  const selected = checks.find((c) => c.id === selectedId);

  const [plan, setPlan] = useState('standard');
  const [amount, setAmount] = useState('');
  const [entities, setEntities] = useState('1');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sentUrl, setSentUrl] = useState('');

  useEffect(() => {
    setPlan(selected?.plan_hint ?? 'standard');
    setNotes(selected?.notes ?? '');
    setAmount('');
    setSentUrl('');
  }, [selectedId, selected?.plan_hint, selected?.notes]);

  async function saveInReview() {
    if (!selected) return;
    setError('');
    const { error } = await db
      .from('exposure_checks')
      .update({ status: 'in_review', notes: notes || null })
      .eq('id', selected.id);
    if (error) setError(error.message); else onChanged();
  }

  async function sendQuote() {
    if (!selected) return;
    const dollars = Number(amount.replace(/[^0-9.]/g, ''));
    if (!dollars) return setError('Enter the quote amount first.');

    setSending(true);
    setError('');
    if (notes) await db.from('exposure_checks').update({ notes }).eq('id', selected.id);

    const res = await fetch('/api/admin/quotes/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exposure_check_id: selected.id,
        plan,
        amount_cents: Math.round(dollars * 100),
        entities_quoted: Number(entities) || 1,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) return setError(data.error ?? 'Could not send the quote.');
    setSentUrl(data.invoice_url ?? '');
    onChanged();
  }

  return (
    <section className="view">
      <div className="head">
        <div>
          <h1 className="h1">Exposure checks</h1>
          <p className="sub">Every free check submitted from the site. Look them up, then send the quote.</p>
        </div>
      </div>
      <div className="card mb">
        <h3>Queue</h3>
        <CheckTable checks={checks} onOpen={(c) => setSelectedId(c.id)} selectedId={selectedId} />
      </div>

      {selected && (
        <div className="card">
          <div className="dsec">
            <h4>What they told us</h4>
            <div className="f2">
              <Field label="Company" value={selected.company} />
              <Field label="Name" value={selected.contact_name} />
            </div>
            <div className="f2">
              <Field label="Job title" value={selected.job_title ?? '—'} />
              <Field label="Work email" value={selected.email} />
            </div>
            <div className="f2">
              <Field label="Reason" value={selected.reason_other || (selected.reason ? REASON_LABEL[selected.reason] ?? selected.reason : '—')} />
              <Field label="Other names" value={selected.other_names ?? '—'} />
            </div>
          </div>

          <div className="dsec">
            <h4>Report and quote</h4>
            <div className="f2">
              <label className="field">
                <span>Plan</span>
                <select value={plan} onChange={(e) => setPlan(e.target.value)}>
                  <option value="standard">Standard</option>
                  <option value="multi">Multi-Entity</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <label className="field">
                <span>Entities quoted</span>
                <input value={entities} onChange={(e) => setEntities(e.target.value)} />
              </label>
            </div>
            <div className="f2">
              <label className="field">
                <span>Quote (USD, per year)</span>
                <input placeholder="$" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <div />
            </div>
            <div className="row">
              <button className="pill pill-coral" type="button" disabled={sending || selected.status === 'sent'} onClick={sendQuote}>
                <IconMail /> {sending ? 'Sending…' : 'Send quote as invoice'}
              </button>
              <button className="pill pill-light" type="button" onClick={saveInReview}>Save as in review</button>
            </div>
            {sentUrl && (
              <p className="note">
                Invoice sent. <a className="lnk" href={sentUrl} target="_blank" rel="noreferrer">Open it in Stripe</a>
              </p>
            )}
            <p className="note">
              Sending raises a real Stripe invoice for this amount and emails it to {selected.email}.
              Attaching the exposure report PDF is not wired up yet.
            </p>
          </div>

          <div className="dsec">
            <h4>Notes</h4>
            <label className="field">
              <textarea placeholder="Internal note for the team" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} readOnly />
    </label>
  );
}

/** A link that turns into an input - the prototype's "Add a name" pattern. */
function AdminAddRow({ label, placeholder, onAdd }: {
  label: string; placeholder: string; onAdd: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  if (!open) {
    return (
      <a className="lnk" style={{ cursor: 'pointer' }} onClick={() => setOpen(true)}>
        <IconPlus size={14} /> {label}
      </a>
    );
  }

  return (
    <label className="field" style={{ marginTop: 8 }}>
      <input
        autoFocus
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { setOpen(false); setValue(''); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); setValue(''); }
          if (e.key === 'Enter' && value.trim()) {
            onAdd(value.trim());
            setValue('');
            setOpen(false);
          }
        }}
      />
    </label>
  );
}
