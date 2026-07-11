import { useState } from 'react';
import { isValidBangladeshPhone, normalizeBangladeshPhone } from '../lib/utils.js';

export default function Login({ auth }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!auth.isConfigured) {
    return (
      <div className="center-screen">
        <div className="card login-card">
          <h2>Firebase is not configured</h2>
          <p className="muted">
            Set the <code>VITE_FIREBASE_*</code> environment variables (see <code>.env.example</code>) then reload.
          </p>
        </div>
      </div>
    );
  }

  async function handlePhoneLogin(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const normalized = normalizeBangladeshPhone(phone);
      if (!isValidBangladeshPhone(normalized)) {
        setError('Enter a valid Bangladeshi phone number (01XXXXXXXXX).');
        return;
      }
      await auth.loginWithPhone(normalized, password);
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
    <div className="center-screen login-screen">
      <div className="card login-card">
        <div className="login-brand">
          <h1>Kabbo Digital Ledger</h1>
          <p className="muted">Sign in with your shop phone number — same as Shopstick.</p>
        </div>

        <form onSubmit={handlePhoneLogin}>
          <label className="field-label">Phone Number</label>
          <div className="phone-input-wrap">
            <span className="phone-prefix">+88</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              required
            />
          </div>

          <label className="field-label">Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button className="btn btn-secondary btn-block" onClick={handleGoogleLogin} disabled={busy}>
          Continue with Google
        </button>

        <p className="muted small login-footnote">
          Team members invited by email can also use Google sign-in from Settings.
        </p>
      </div>
    </div>
  );
}
