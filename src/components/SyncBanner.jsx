function permissionHint(code) {
  if (code === 'permission-denied') {
    return 'Firestore blocked this account. Sign out, ask the owner to set your role to Manager in Settings, then sign in again.';
  }
  if (code === 'unavailable') {
    return 'Could not reach the database. Check internet and try again.';
  }
  return null;
}

export default function SyncBanner({ online, shopError, memberReady, memberError, role }) {
  if (memberError) {
    const hint = permissionHint(memberError.code);
    return (
      <div className="sync-banner sync-banner--error" data-online={online}>
        <strong>Cannot sync — {memberError.message}</strong>
        {hint && <p className="sync-banner-detail">{hint}</p>}
      </div>
    );
  }

  if (!memberReady && role !== 'owner') {
    return (
      <div className="sync-banner sync-banner--warn" data-online={online}>
        Setting up your shop access…
      </div>
    );
  }

  if (shopError?.code === 'permission-denied') {
    return (
      <div className="sync-banner sync-banner--error" data-online={online}>
        <strong>Live feed blocked for this account.</strong>
        <p className="sync-banner-detail">
          Your role is <em>{role || 'unknown'}</em>. Ask the owner to confirm you appear under Settings → Team with role
          Manager, then sign out and back in.
        </p>
      </div>
    );
  }

  if (shopError) {
    return (
      <div className="sync-banner sync-banner--warn" data-online={online}>
        Sync issue: {shopError.message}
      </div>
    );
  }

  if (!online) {
    return (
      <div className="sync-banner" data-online="false">
        Offline — your changes save locally and sync automatically when back online
      </div>
    );
  }

  return (
    <div className="sync-banner" data-online="true">
      Online — synced live across every device ({role})
    </div>
  );
}
