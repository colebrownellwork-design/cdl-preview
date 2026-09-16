'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Viewer } from '@/lib/auth';
import { fmtDate, fmtDay, fmtMonth, yearOf, initials, PLAN_LABEL } from '@/lib/format';
import {
  IconHome, IconDoc, IconUser, IconOut, IconDownload, IconTrash, IconPlus, IconMail, IconVisa,
} from '@/app/_components/icons';

type Name = { id: string; name: string; status: 'being_added' | 'protected' | 'withdrawn' };
type Entity = { id: string; legal_name: string; protected_since: string | null; entity_names: Name[] };
type Report = {
  id: string; period: string; is_baseline: boolean; summary: string | null;
  platforms_checked: number | null; records_found: number | null;
  sent_at: string | null; storage_path: string | null;
};
type Recipient = { id: string; name: string | null; email: string };
type Invoice = {
  id: string; number: string | null; description: string | null; amount_cents: number;
  status: string; hosted_invoice_url: string | null; pdf_url: string | null; issued_on: string | null;
};
type Account = {
  id: string; name: string; plan: string | null; status: string;
  protected_since: string | null; next_check_on: string | null; renewal_on: string | null;
  stripe_customer_id: string | null;
};

type View = 'home' | 'reports' | 'account';
const LABEL: Record<View, string> = { home: 'Home', reports: 'Reports', account: 'Account' };

export default function Portal({
  viewer, account, entities, reports, recipients, invoices,
}: {
  viewer: Viewer; account: Account; entities: Entity[]; reports: Report[];
  recipients: Recipient[]; invoices: Invoice[];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>('home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The design navigates by hash, so keep that working on reload and Back.
  useEffect(() => {
    const sync = () => {
      const v = location.hash.slice(1) as View;
      setView(LABEL[v] ? v : 'home');
    };
    sync();
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);

  const go = (v: View) => {
    history.replaceState(null, '', `#${v}`);
    setView(v);
  };

  /** Runs a mutation, surfaces failure, and re-reads from the server. */
  async function run(label: string, fn: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true);
    setError('');
    const { error } = await fn();
    setBusy(false);
    if (error) return setError(`${label}: ${error.message}`);
    router.refresh();
  }

  const db = supabaseBrowser();
  const monthly = reports.filter((r) => !r.is_baseline);
  const baseline = reports.find((r) => r.is_baseline);
  const latest = monthly[0];

  const summaryLine = [
    account.protected_since && `Since ${fmtDate(account.protected_since)}.`,
    latest?.sent_at && `Last check ${fmtDay(latest.sent_at)}, ${latest.summary ?? 'nothing new'}.`,
    account.next_check_on && `Next check ${fmtDay(account.next_check_on)}.`,
    account.renewal_on && `Renews on its own, ${fmtDate(account.renewal_on)}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="app">
      <aside className="side">
        <div className="logo">
          <a href="/">
            <img src="/logo/official/cdl-logo-dark-for-light-bg.png" alt="Customs Data Lock" />
          </a>
        </div>
        <div className="co">
          <span className="mg" style={{ '--c': '#1D395B' } as React.CSSProperties}>
            {initials(account.name)}
          </span>
          <div>
            <b>{account.name}</b>
            <span>
              {account.protected_since ? `Protected since ${fmtDate(account.protected_since)}` : 'Onboarding'}
            </span>
          </div>
        </div>
        <div className="who">Your account</div>
        <nav>
          {(['home', 'reports', 'account'] as View[]).map((v) => (
            <a
              key={v}
              href={`#${v}`}
              className={view === v ? 'on' : undefined}
              onClick={(e) => { e.preventDefault(); go(v); }}
            >
              {v === 'home' ? <IconHome /> : v === 'reports' ? <IconDoc /> : <IconUser />}
              {LABEL[v]}
            </a>
          ))}
        </nav>
        <div className="acct">
          <span className="av">{initials(viewer.full_name ?? viewer.email)}</span>
          <div>
            <b>{viewer.full_name ?? viewer.email}</b>
            <span>{account.name}</span>
          </div>
          <a
            className="out"
            href="/login"
            title="Log out"
            onClick={async (e) => {
              e.preventDefault();
              await db.auth.signOut();
              router.push('/login');
            }}
          >
            <IconOut />
          </a>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumb">
            <b>{account.name}</b> / <span>{LABEL[view]}</span>
          </div>
          <div className="row">
            <span className="status">{account.status === 'protected' ? 'Protected' : account.status.replace('_', ' ')}</span>
          </div>
        </div>

        {error && (
          <p role="alert" style={{ margin: '0 0 16px', color: '#B42318', fontSize: 14 }}>{error}</p>
        )}

        {view === 'home' && (
          <section className="view">
            <div className="head">
              <div>
                <h1 className="h1">
                  {account.name} {account.status === 'protected' ? 'is protected.' : 'is being onboarded.'}
                </h1>
                <p className="sub">{summaryLine}</p>
              </div>
              {latest && (
                <a className="pill pill-dark pill-sm" href="#reports" onClick={(e) => { e.preventDefault(); go('reports'); }}>
                  <IconDownload /> Latest report
                </a>
              )}
            </div>

            <h3 className="sect">
              Names we protect <span className="m2"><i className="dot amber" /> being added</span>
            </h3>
            <div className="grid g3 mb">
              {entities.map((entity) => (
                <EntityCard key={entity.id} entity={entity} busy={busy} onAdd={(name) =>
                  run('Could not add that name', async () =>
                    db.from('entity_names').insert({ entity_id: entity.id, name, status: 'being_added' }))
                } onWithdraw={(id) =>
                  run('Could not withdraw that name', async () =>
                    db.from('entity_names').delete().eq('id', id))
                } />
              ))}
            </div>

            <div className="grid g2">
              <div className="card">
                <h3>
                  Latest report{' '}
                  <a href="#reports" onClick={(e) => { e.preventDefault(); go('reports'); }}>All reports</a>
                </h3>
                <ul className="docs">
                  {latest ? (
                    <ReportRow
                      report={latest}
                      note={`Sent ${fmtDay(latest.sent_at)} to ${recipients.map((r) => (r.name ?? r.email).split(' ')[0]).join(' and ')} · ${latest.platforms_checked ?? 0} platforms · ${latest.summary ?? 'nothing new'}`}
                    />
                  ) : (
                    <li><div><b>No reports yet</b><span className="s">Your first report follows your first check.</span></div></li>
                  )}
                </ul>
              </div>
              <div className="card">
                <h3>Need something?</h3>
                <ul className="quick">
                  <li><a href="mailto:hello@customsdatalock.com?subject=Add an entity"><IconPlus /> Add another company or entity</a></li>
                  <li><a href="#account" onClick={(e) => { e.preventDefault(); go('account'); }}><IconMail /> Change who gets the reports</a></li>
                  <li><a href="mailto:hello@customsdatalock.com"><IconUser size={16} /> Talk to a person · hello@customsdatalock.com</a></li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {view === 'reports' && (
          <section className="view">
            <div className="head">
              <div>
                <h1 className="h1">Reports</h1>
                <p className="sub">One a month, after every check. Nothing new means exactly that.</p>
              </div>
            </div>
            <div className="grid g21">
              <div className="card">
                {groupByYear(monthly).map(([year, rows], i) => (
                  <div key={year}>
                    <div className="year" style={i ? { marginTop: 26 } : undefined}>{year}</div>
                    <ul className="docs">
                      {rows.map((r) => (
                        <ReportRow key={r.id} report={r} note={`Sent ${fmtDay(r.sent_at)} · ${r.summary ?? 'nothing new'}`} />
                      ))}
                    </ul>
                  </div>
                ))}
                {!monthly.length && <p className="note">No reports yet.</p>}
              </div>
              <div>
                {baseline && (
                  <div className="card mb">
                    <h3>Before we started</h3>
                    <ul className="docs">
                      <ReportRow
                        report={baseline}
                        title="Exposure report"
                        iconClass="x"
                        note={`${fmtDate(baseline.sent_at)} · ${baseline.summary ?? ''}`}
                      />
                    </ul>
                    <p className="note">
                      What anyone could see before {fmtDate(account.protected_since)}.
                    </p>
                  </div>
                )}
                <div className="card">
                  <h3>
                    Sent to{' '}
                    <a href="#account" onClick={(e) => { e.preventDefault(); go('account'); }}>Change</a>
                  </h3>
                  <p className="m2">
                    {recipients.map((r) => <span key={r.id}>{r.email}<br /></span>)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {view === 'account' && (
          <AccountView
            viewer={viewer} account={account} recipients={recipients} invoices={invoices}
            entityCount={entities.length} busy={busy} setError={setError} run={run}
          />
        )}
      </main>
    </div>
  );
}

function groupByYear(reports: Report[]): [number, Report[]][] {
  const by = new Map<number, Report[]>();
  for (const r of reports) {
    const y = yearOf(r.period);
    by.set(y, [...(by.get(y) ?? []), r]);
  }
  return [...by.entries()].sort((a, b) => b[0] - a[0]);
}

function ReportRow({ report, note, title, iconClass }: {
  report: Report; note: string; title?: string; iconClass?: string;
}) {
  return (
    <li>
      <div className={`doc-ico${iconClass ? ' ' + iconClass : ''}`}><i /><i /><i /></div>
      <div>
        <b>{title ?? fmtMonth(report.period)}</b>
        <span className="s">{note}</span>
      </div>
      {/* The PDF itself is not generated yet, so the control only appears
          once there is a file behind it. */}
      {report.storage_path && (
        <a className="dl" href={report.storage_path}><IconDownload /></a>
      )}
    </li>
  );
}

function EntityCard({ entity, busy, onAdd, onWithdraw }: {
  entity: Entity; busy: boolean;
  onAdd: (name: string) => void; onWithdraw: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  return (
    <div className="card">
      <div className="ent-head">
        <b>{entity.legal_name}</b>
        <span>{entity.protected_since ? `since ${fmtDate(entity.protected_since)}` : 'being added'}</span>
      </div>
      <ul className="nm">
        {entity.entity_names.map((n) =>
          n.status === 'being_added' ? (
            <li key={n.id} className="pend">
              <i className="dot amber" />
              <span className="n">{n.name}</span>
              <em>being added</em>
              <span className="del" title="Withdraw" onClick={() => !busy && onWithdraw(n.id)}>
                <IconTrash />
              </span>
            </li>
          ) : (
            <li key={n.id}>
              <span className="n">{n.name}</span>
              {/* A protected name is on a filing with CBP, so removing it is a
                  change we make, not a row the customer can delete. */}
              <a
                className="del"
                title="Ask us to remove this name"
                href={`mailto:hello@customsdatalock.com?subject=${encodeURIComponent(`Remove a name: ${n.name}`)}`}
              >
                <IconTrash />
              </a>
            </li>
          ),
        )}
        <li className={`add${open ? ' open' : ''}`} onClick={() => setOpen(true)}>
          <span className="plus"><IconPlus /></span>
          {!open && <span className="lbl">Add a name</span>}
          {open && (
            <input
              autoFocus
              placeholder="Name as it appears, then Enter"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => { setOpen(false); setValue(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setValue(''); }
                if (e.key === 'Enter' && value.trim()) {
                  onAdd(value.trim());
                  setOpen(false);
                  setValue('');
                }
              }}
            />
          )}
        </li>
      </ul>
    </div>
  );
}

function AccountView({ viewer, account, recipients, invoices, entityCount, busy, setError, run }: {
  viewer: Viewer; account: Account; recipients: Recipient[]; invoices: Invoice[];
  entityCount: number; busy: boolean; setError: (s: string) => void;
  run: (label: string, fn: () => Promise<{ error: { message: string } | null }>) => Promise<void>;
}) {
  const db = supabaseBrowser();
  const [fullName, setFullName] = useState(viewer.full_name ?? '');
  const [phone, setPhone] = useState(viewer.phone ?? '');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  async function updateCard() {
    setError('');
    const res = await fetch('/api/portal/billing', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? 'Could not open billing.');
    location.href = data.url;
  }

  return (
    <section className="view">
      <div className="head">
        <div>
          <h1 className="h1">Account</h1>
          <p className="sub">Who gets the reports, how we bill you, and how you sign in.</p>
        </div>
      </div>
      <div className="grid g2">
        <div>
          <div className="card mb">
            <h3>
              Report recipients{' '}
              <a onClick={() => setAdding((v) => !v)} style={{ cursor: 'pointer' }}>
                <IconPlus size={14} /> Add
              </a>
            </h3>
            {recipients.map((r) => (
              <div className="setrow" key={r.id}>
                <div className="row">
                  <span className="av sm">{initials(r.name ?? r.email)}</span>
                  <div>
                    <b>{r.name ?? r.email}</b>
                    <span className="s">{r.email}</span>
                  </div>
                </div>
                {r.email === viewer.email ? (
                  <span className="tag mute">You</span>
                ) : (
                  <span
                    className="del"
                    style={{ opacity: 0.6, color: 'var(--muted-2)', cursor: 'pointer' }}
                    onClick={() => !busy && run('Could not remove', async () =>
                      db.from('report_recipients').delete().eq('id', r.id))}
                  >
                    <IconTrash />
                  </span>
                )}
              </div>
            ))}
            {adding && (
              <div className="f2" style={{ marginTop: 12 }}>
                <label className="field">
                  <span>Name</span>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveRecipient()}
                  />
                </label>
                <button className="pill pill-dark pill-sm" type="button" disabled={busy} onClick={saveRecipient}>
                  Add recipient
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Your details</h3>
            <div className="f2">
              <label className="field">
                <span>Name</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
            </div>
            <div className="fstack">
              <label className="field">
                <span>Work email</span>
                {/* Changing this changes how you sign in, so it goes through us. */}
                <input value={viewer.email} readOnly title="Email is how you sign in - contact us to change it" />
              </label>
            </div>
            <button
              className="pill pill-dark pill-sm"
              type="button"
              disabled={busy}
              onClick={() => run('Could not save', async () =>
                db.from('profiles').update({ full_name: fullName, phone }).eq('id', viewer.id))}
            >
              Save
            </button>
          </div>
        </div>

        <div>
          <div className="card mb">
            <h3>
              Billing{' '}
              {account.stripe_customer_id && (
                <a onClick={updateCard} style={{ cursor: 'pointer' }}>Update card</a>
              )}
            </h3>
            <div className="setrow">
              <div>
                <b>
                  {account.plan ? PLAN_LABEL[account.plan] : 'No plan yet'}
                  {entityCount > 1 ? ` · ${entityCount} entities` : ''}
                </b>
                <span className="s">
                  {account.renewal_on
                    ? `Renews ${fmtDate(account.renewal_on)} on the card on file. Nothing to do.`
                    : 'No renewal date set yet.'}
                </span>
              </div>
            </div>
            <div className="setrow">
              <div>
                <b><IconVisa />{account.stripe_customer_id ? 'Card on file' : 'No card on file'}</b>
                <span className="s">
                  {account.stripe_customer_id
                    ? 'Managed by Stripe. Card details never touch this site.'
                    : 'Added when your first invoice is paid.'}
                </span>
              </div>
            </div>
            {invoices.length > 0 && (
              <table style={{ marginTop: 10 }}>
                <tbody>
                  <tr><th>Invoice</th><th>Date</th><th className="r" /></tr>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <b>{inv.number ?? '—'}</b>
                        {inv.description && <span className="m2"> · {inv.description}</span>}
                      </td>
                      <td className="m">{fmtDate(inv.issued_on)}</td>
                      <td className="r">
                        {inv.pdf_url ? (
                          <a className="lnk" href={inv.pdf_url}>PDF</a>
                        ) : inv.hosted_invoice_url ? (
                          <a className="lnk" href={inv.hosted_invoice_url}>View</a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <h3>Sign in</h3>
            <div className="setrow">
              <div>
                <b>Password</b>
                <span className="s">Change it by email, so nobody else can.</span>
              </div>
              <a
                className="lnk"
                style={{ cursor: 'pointer' }}
                onClick={() => run('Could not send', async () =>
                  db.auth.resetPasswordForEmail(viewer.email, {
                    redirectTo: `${location.origin}/auth/callback?next=/portal`,
                  }))}
              >
                Change
              </a>
            </div>
            <div className="setrow">
              <div>
                <b>Sign-in link by email</b>
                <span className="s">Always available - use "Email me a sign-in link" on the login page.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  function saveRecipient() {
    if (!newEmail.trim()) return;
    run('Could not add recipient', async () =>
      db.from('report_recipients').insert({
        account_id: account.id,
        name: newName.trim() || null,
        email: newEmail.trim().toLowerCase(),
      }),
    );
    setNewName('');
    setNewEmail('');
    setAdding(false);
  }
}
