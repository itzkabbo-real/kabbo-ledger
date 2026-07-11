import { useState } from 'react';

export default function Login({ auth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!auth.isConfigured) {
    return (
      <div className="center-screen">
        <div className="card">
          <h2>Firebase is not configured</h2>
          <p className="muted">
            Set the <code>VITE_FIREBASE_*</code> environment variables (see <code>.env.example</code>) then
            reload. Without a real Firebase project this app cannot sync anything between devices.
          </p>
        </div>
      </div>
    );
  }

  async function handleEmailLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await auth.loginWithEmail(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setError('');
    try {
      await auth.loginWithGoogle();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="card login-card">
        <h1>Kabbo Digital Ledger</h1>
        <p className="muted">Sign in to see the live shop feed.</p>
        <form onSubmit={handleEmailLogin}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <button className="btn btn-secondary" onClick={handleGoogleLogin} disabled={busy}>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
