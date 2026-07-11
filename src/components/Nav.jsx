const TABS = [
  { id: 'dashboard', label: 'Dashboard', roles: ['owner', 'manager', 'staff'] },
  { id: 'pos', label: 'POS', roles: ['owner', 'manager', 'staff'] },
  { id: 'stock', label: 'Stock', roles: ['owner', 'manager', 'staff'] },
  { id: 'dues', label: 'Dues', roles: ['owner', 'manager', 'staff'] },
  { id: 'ledger', label: 'Ledger', roles: ['owner', 'manager', 'staff'] },
  { id: 'reports', label: 'Reports', roles: ['owner', 'manager'] },
  { id: 'settings', label: 'Settings', roles: ['owner', 'manager'] },
];

export default function Nav({ active, onChange, role }) {
  const visible = TABS.filter((t) => t.roles.includes(role));
  return (
    <nav className="bottom-nav">
      {visible.map((tab) => (
        <button
          key={tab.id}
          className={active === tab.id ? 'nav-btn nav-btn--active' : 'nav-btn'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
