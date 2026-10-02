import { useEffect, useRef } from "react";
import { formatRoomActivityTime } from "../collaborationRoomUtils";

export default function CollaborationRoomActivityPanel({ activity = [], onOpen, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideInteraction = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      if (event.target?.closest?.(".collaboration-activity-button")) return;
      onClose();
    };
    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    return () => document.removeEventListener("pointerdown", closeOnOutsideInteraction);
  }, [onClose]);

  return (
      <section ref={panelRef} className="collaboration-activity-panel" aria-label="Room Activity" onMouseDown={(event) => event.stopPropagation()}>
        <header><strong>Room Activity</strong><small>Latest 25 meaningful updates</small></header>
        {activity.length ? activity.map((item) => {
          const actor = String(item.actor_email || item.action_text || "Mabaso member").split("@")[0].trim() || "M";
          const context = item.resource_title || ({
            admin_control_started: "Members can now follow the owner's Room view.",
            admin_control_stopped: "Independent Room navigation has resumed.",
            board_item_edited: "Board item updated",
            board_item_added: "New board item",
          }[item.activity_type]) || "Open this update in the Room.";
          return (
            <button type="button" key={item.id} className="collaboration-activity-entry" onClick={() => onOpen(item)}>
              <span className="collaboration-activity-entry-avatar" aria-hidden="true">{actor.slice(0, 2).toUpperCase()}</span>
              <span className="collaboration-activity-entry-copy">
                <strong>{item.action_text}</strong>
                <small>{context}</small>
                <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()}>{formatRoomActivityTime(item.created_at)}</time>
              </span>
            </button>
          );
        }) : <p>No Room activity yet. Shared materials, board changes, and Admin Control updates will appear here.</p>}
      </section>
  );
}
