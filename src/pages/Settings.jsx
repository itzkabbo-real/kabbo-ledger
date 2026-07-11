import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, SHOP_ID } from '../firebase.js';
import { authEmailToPhone, inviteKeyFromInput, phoneToAuthEmail } from '../lib/utils.js';

export default function Settings({ user, role, memberError, memberReady }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteContact, setInviteContact] = useState('');
  const [inviteRoleChoice, setInviteRoleChoice] = useState('manager');
  const [telegram, setTelegram] = useState({ status: 'checking' });
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shops', SHOP_ID, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (role !== 'owner' && role !== 'manager') return undefined;
    const unsub = onSnapshot(collection(db, 'shops', SHOP_ID, 'invites'), (snap) => {
      setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [role]);

  useEffect(() => {
    fetch('/.netlify/functions/telegram-status')
      .then((r) => r.json())
      .then(setTelegram)
      .catch(() => setTelegram({ status: 'unreachable' }));
  }, []);

  async function setRole(memberId, newRole) {
    await updateDoc(doc(db, 'shops', SHOP_ID, 'members', memberId), { role: newRole });
  }

  async function sendInvite(e) {
    e.preventDefault();
    const key = inviteKeyFromInput(inviteContact);
    if (!key) return;
    await setDoc(doc(db, 'shops', SHOP_ID, 'invites', key), {
      invitedBy: user?.email || 'owner',
      role: inviteRoleChoice,
      createdAt: serverTimestamp(),
    });
    setInviteContact('');
    setFeedback(`Invite saved for ${key}. They must sign in with that exact account.`);
  }

  async function revokeInvite(email) {
    await deleteDoc(doc(db, 'shops', SHOP_ID, 'invites', email));
  }

  const phone = authEmailToPhone(user?.email || '');

  return (
    <div className="page">
      <div className="card">
        <h3>Sync status</h3>
        {memberError ? (
          <>
            <p className="status-pill status-pill--due">Blocked</p>
            <p className="error-text">{memberError.message}</p>
            <p className="muted small">
              Managers: sign out completely, then sign back in after the owner sets your role to Manager below.
            </p>
          </>
        ) : memberReady ? (
          <p className="status-pill status-pill--in_stock">Connected — live sync active</p>
        ) : (
          <p className="muted">Setting up shop access…</p>
        )}
        <p className="muted small">
          Role: <strong>{role}</strong>
          {phone ? ` · Phone ${phone}` : ''}
        </p>
      </div>

      <div className="card">
        <h3>Telegram alerts</h3>
        {telegram.status === 'connected' && <p className="status-pill status-pill--in_stock">Connected</p>}
        {telegram.status === 'not_configured' && (
          <>
            <p className="status-pill status-pill--sold">Not configured</p>
            <p className="muted small">Missing: {(telegram.missing || []).join(', ') || 'unknown env vars'}</p>
          </>
        )}
        {telegram.status === 'checking' && <p className="muted">Checking...</p>}
        {telegram.status === 'unreachable' && <p className="muted">Could not reach status endpoint.</p>}
      </div>

      {role === 'owner' && (
        <div className="card">
          <h3>Invite a team member</h3>
          <p className="muted small">
            Use their Google email <em>or</em> shop phone (01XXXXXXXXX). Phone logins map to{' '}
            <code>{phoneToAuthEmail('01700000000').replace('01700000000', '01XXXXXXXXX')}</code>.
          </p>
          <form className="grid-form" onSubmit={sendInvite}>
            <input
              placeholder="Email or phone (01XXXXXXXXX)"
              value={inviteContact}
              onChange={(e) => setInviteContact(e.target.value)}
              required
            />
            <select value={inviteRoleChoice} onChange={(e) => setInviteRoleChoice(e.target.value)}>
              <option value="manager">Manager (can add sales & stock)</option>
              <option value="staff">Staff (view only)</option>
            </select>
            <button className="btn btn-primary" type="submit">
              Send invite
            </button>
          </form>
          {feedback && <p className="muted">{feedback}</p>}
          {invites.length > 0 && (
            <ul className="list">
              {invites.map((inv) => (
                <li key={inv.id} className="list-row">
                  <span>
                    {inv.id} <span className="muted small">({inv.role || 'manager'})</span>
                  </span>
                  <button className="btn btn-secondary btn-sm" onClick={() => revokeInvite(inv.id)}>
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <h3>Team &amp; roles</h3>
        <ul className="list">
          {members.map((m) => (
            <li key={m.id} className="list-row">
              <div>
                <strong>{m.displayName || m.email}</strong>
                <div className="muted small">{m.email}</div>
              </div>
              {role === 'owner' && m.role !== 'owner' ? (
                <select value={m.role} onChange={(e) => setRole(m.id, e.target.value)}>
                  <option value="staff">Staff</option>
                  <option value="manager">Manager</option>
                </select>
              ) : (
                <span className="status-pill">{m.role}</span>
              )}
            </li>
          ))}
        </ul>
        {role === 'manager' && (
          <p className="muted small">Ask the owner to change roles here if your access looks wrong.</p>
        )}
      </div>

      <div className="card">
        <h3>Account</h3>
        <p>Signed in as {user?.email}</p>
        <p className="muted small">Role: {role}</p>
      </div>
    </div>
  );
}
