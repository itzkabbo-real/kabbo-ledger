import { useEffect, useState } from 'react';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db, SHOP_ID } from '../firebase.js';

export default function Settings({ user, role }) {
  const [members, setMembers] = useState([]);
  const [telegram, setTelegram] = useState({ status: 'checking' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shops', SHOP_ID, 'members'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    fetch('/.netlify/functions/telegram-status')
      .then((r) => r.json())
      .then(setTelegram)
      .catch(() => setTelegram({ status: 'unreachable' }));
  }, []);

  async function setRole(memberId, newRole) {
    await updateDoc(doc(db, 'shops', SHOP_ID, 'members', memberId), { role: newRole });
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
