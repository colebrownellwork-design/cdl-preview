'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { IconTrash, IconPlus } from '@/app/_components/icons';
import { fmtDate, PLAN_LABEL } from '@/lib/format';

export type EntityName = { id: string; name: string; status: string };
export type Entity = {
  id: string;
  account_id: string;
  legal_name: string;
  status: string;
  protected_since: string | null;
  entity_names: EntityName[];
};
export type Recipient = { id: string; account_id: string; name: string | null; email: string };
export type Account = {
  id: string;
  name: string;
  plan: string | null;
  status: string;
  protected_since: string | null;
  next_check_on: string | null;
  renewal_on: string | null;
  renewal_is_automatic: boolean;
  stripe_customer_id: string | null;
};

const STATUSES = ['lead', 'quote_sent', 'protected', 'renewal_due', 'lapsed'] as const;

/** Everything about one account, editable. Writes go straight to the database
 *  as the signed-in staffer, so RLS is the thing granting access. */
export default function AccountDetail({
  account, entities, recipients, onChanged, onClose, onError,
}: {
  account: Account;
  entities: Entity[];
  recipients: Recipient[];
  onChanged: () => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const db = supabaseBrowser();
  const [form, setForm] = useState(account);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // A different row was opened - show that account instead of the old edits.
  useEffect(() => {
    setForm(account);
    setSaved(false);
  }, [account]);

  const set = <K extends keyof Account>(key: K, value: Account[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function run(label: string, fn: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return onError(`${label}: ${error.message}`);
    onChanged();
  }

  async function save() {
    setBusy(true);
    const { error } = await db
      .from('accounts')
      .update({
        name: form.name.trim(),
        plan: form.plan || null,
        status: form.status,
        protected_since: form.protected_since || null,
        next_check_on: form.next_check_on || null,
        renewal_on: form.renewal_on || null,
        renewal_is_automatic: form.renewal_is_automatic,
      })
      .eq('id', account.id);
    setBusy(false);
    if (error) return onError(`Could not save: ${error.message}`);
    setSaved(true);
    onChanged();
  }

  return (
    <div className="card">
      <div className="dsec">
        <h4>
          {account.name || 'New account'}{' '}
          <a className="lnk" style={{ cursor: 'pointer', float: 'right' }} onClick={onClose}>
            Close
          </a>
        </h4>

        <div className="f2">
          <label className="field">
            <span>Company name</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="field">
            <span>Plan</span>
            <select value={form.plan ?? ''} onChange={(e) => set('plan', e.target.value || null)}>
              <option value="">Not set</option>
              {Object.entries(PLAN_LABEL).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="f2">
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Protected since</span>
            <input type="date" value={form.protected_since ?? ''} onChange={(e) => set('protected_since', e.target.value)} />
          </label>
        </div>

        <div className="f2">
          <label className="field">
            <span>Next check</span>
            <input type="date" value={form.next_check_on ?? ''} onChange={(e) => set('next_check_on', e.target.value)} />
          </label>
          <label className="field">
            <span>Renews</span>
            <input type="date" value={form.renewal_on ?? ''} onChange={(e) => set('renewal_on', e.target.value)} />
          </label>
        </div>

        <div className="setrow">
          <div>
            <b>Renews automatically</b>
            <span className="s">
              {form.stripe_customer_id
                ? 'Card on file in Stripe.'
                : 'No Stripe customer yet - a renewal will need a person.'}
            </span>
          </div>
          <input
            type="checkbox"
            checked={form.renewal_is_automatic}
            onChange={(e) => set('renewal_is_automatic', e.target.checked)}
          />
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="pill pill-dark pill-sm" type="button" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save account'}
          </button>
          {saved && <span className="tag green">Saved</span>}
        </div>
      </div>

      <div className="dsec">
        <h4>Entities and the names they ship under</h4>
        {entities.map((entity) => (
          <EntityBlock
            key={entity.id}
            entity={entity}
            busy={busy}
            onAddName={(name) =>
              run('Could not add the name', async () =>
                db.from('entity_names').insert({ entity_id: entity.id, name, status: 'protected' }))
            }
            onRemoveName={(id) =>
              run('Could not remove the name', async () => db.from('entity_names').delete().eq('id', id))
            }
            onToggleName={(id, status) =>
              run('Could not update the name', async () =>
                db.from('entity_names').update({ status }).eq('id', id))
            }
            onRemoveEntity={() =>
              run('Could not remove the entity', async () => db.from('entities').delete().eq('id', entity.id))
            }
          />
        ))}
        <AddRow
          label="Add an entity"
          placeholder="Legal name, then Enter"
          busy={busy}
          onAdd={(legal_name) =>
            run('Could not add the entity', async () =>
              db.from('entities').insert({
                account_id: account.id,
                legal_name,
                status: 'pending',
              }))
          }
        />
      </div>

      <div className="dsec">
        <h4>Report recipients</h4>
        {recipients.map((r) => (
          <div className="setrow" key={r.id}>
            <div>
              <b>{r.name ?? r.email}</b>
              <span className="s">{r.email}</span>
            </div>
            <span
              className="del"
              style={{ cursor: 'pointer' }}
              onClick={() => !busy && run('Could not remove', async () =>
                db.from('report_recipients').delete().eq('id', r.id))}
            >
              <IconTrash />
            </span>
          </div>
        ))}
        {!recipients.length && (
          <p className="note">
            Nobody gets the reports yet. An invoice also needs an address here.
          </p>
        )}
        <AddRow
          label="Add a recipient"
          placeholder="name@company.com, then Enter"
          busy={busy}
          onAdd={(email) =>
            run('Could not add the recipient', async () =>
              db.from('report_recipients').insert({
                account_id: account.id,
                email: email.trim().toLowerCase(),
              }))
          }
        />
      </div>
    </div>
  );
}

function EntityBlock({
  entity, busy, onAddName, onRemoveName, onToggleName, onRemoveEntity,
}: {
  entity: Entity; busy: boolean;
  onAddName: (name: string) => void;
  onRemoveName: (id: string) => void;
  onToggleName: (id: string, status: string) => void;
  onRemoveEntity: () => void;
}) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="ent-head">
        <b>{entity.legal_name}</b>
        <span>
          {entity.protected_since ? `since ${fmtDate(entity.protected_since)}` : entity.status}
          {'  '}
          <span className="del" style={{ cursor: 'pointer' }} onClick={() => !busy && onRemoveEntity()}>
            <IconTrash />
          </span>
        </span>
      </div>
      <ul className="nm">
        {entity.entity_names.map((n) => (
          <li key={n.id} className={n.status === 'being_added' ? 'pend' : undefined}>
            {n.status === 'being_added' && <i className="dot amber" />}
            <span className="n">{n.name}</span>
            {/* A customer can only request a name; staff are who mark it filed. */}
            {n.status === 'being_added' && (
              <em
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => !busy && onToggleName(n.id, 'protected')}
              >
                mark protected
              </em>
            )}
            <span className="del" style={{ cursor: 'pointer' }} onClick={() => !busy && onRemoveName(n.id)}>
              <IconTrash />
            </span>
          </li>
        ))}
      </ul>
      <AddRow label="Add a name" placeholder="Name as it appears, then Enter" busy={busy} onAdd={onAddName} />
    </div>
  );
}

/** The prototype's "Add a name" affordance: a link that becomes an input. */
function AddRow({ label, placeholder, busy, onAdd }: {
  label: string; placeholder: string; busy: boolean; onAdd: (value: string) => void;
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
        disabled={busy}
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
