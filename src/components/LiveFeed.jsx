import { timeAgo } from '../lib/utils.js';

export default function LiveFeed({ activity }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Live activity feed</h3>
        <span className="live-dot" title="Updates in real time">
          <span className="pulse" /> Live
        </span>
      </div>
      {activity.length === 0 && <p className="muted">No activity yet. Actions from any device show up here instantly.</p>}
      <ul className="feed-list">
        {activity.slice(0, 25).map((item) => (
          <li key={item.id} className="feed-item">
            <span className={`feed-badge feed-badge--${item.action}`}>{item.action.replace('_', ' ')}</span>
            <div className="feed-body">
              <p>{item.detail}</p>
              <span className="muted small">
                {item.actorName} &middot; {timeAgo(item.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
