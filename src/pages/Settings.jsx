import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, SHOP_ID } from '../firebase.js';

export default function Settings({ user, role }) {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [telegram, setTelegram] = useState({ status: 'checking' });

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
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    // Membership is gated by this doc - without it, VITE_SHOP_ID being public in the
    // client bundle would otherwise let any signed-in Google/email account join.
    await setDoc(doc(db, 'shops', SHOP_ID, 'invites', email), {
      invitedBy: user?.email || 'owner',
      createdAt: serverTimestamp(),
    });
    setInviteEmail('');
  }

  async function revokeInvite(email) {
    await deleteDoc(doc(db, 'shops', SHOP_ID, 'invites', email));
  }

  return (
    <div className="page">
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

      {(role === 'owner' || role === 'manager') && (
        <div className="card">
          <h3>Invite a team member</h3>
          <p className="muted small">
            They must sign in with this exact email before they can see or add anything - the shop id alone is not
            enough to join.
          </p>
          <form className="grid-form" onSubmit={sendInvite}>
            <input
              type="email"
              placeholder="teammate@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <button className="btn btn-primary" type="submit">
              Send invite
            </button>
          </form>
          {invites.length > 0 && (
            <ul className="list">
              {invites.map((inv) => (
                <li key={inv.id} className="list-row">
                  <span>{inv.id}</span>
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
      </div>

      <div className="card">
        <h3>Account</h3>
        <p>Signed in as {user?.email}</p>
        <p className="muted small">Role: {role}</p>
      </div>
    </div>
  );
}
