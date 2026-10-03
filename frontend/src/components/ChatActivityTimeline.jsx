import { Check, ChevronDown, ChevronUp, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function normalizeActivity(activity) {
  if (!activity || typeof activity !== "object") return null;
  const activityType = String(activity.activity_type || "").trim();
  const displayText = String(activity.display_text || "").trim();
  if (!activityType || !displayText) return null;
  return {
    activityType,
    displayText,
    state: activity.state === "completed" ? "completed" : activity.state === "failed" ? "failed" : "active",
    metadata: activity.metadata && typeof activity.metadata === "object" ? activity.metadata : {},
  };
}

function ActivityIcon({ state }) {
  if (state === "completed") return <Check className="chat-activity-icon" aria-hidden="true" />;
  if (state === "failed") return <TriangleAlert className="chat-activity-icon" aria-hidden="true" />;
  return <LoaderCircle className="chat-activity-icon is-spinning" aria-hidden="true" />;
}

export default function ChatActivityTimeline({ activities = [], compact = false }) {
  const [expanded, setExpanded] = useState(true);
  const normalized = useMemo(() => {
    const byType = new Map();
    activities.map(normalizeActivity).filter(Boolean).forEach((activity) => {
      byType.set(activity.activityType, activity);
    });
    return [...byType.values()];
  }, [activities]);
  const current = [...normalized].reverse().find((activity) => activity.state === "active" || activity.state === "failed")
    || normalized[normalized.length - 1];

  useEffect(() => {
    if (current?.activityType === "STREAMING_RESPONSE" || current?.activityType === "COMPLETED") {
      setExpanded(false);
    }
  }, [current?.activityType]);

  if (!current) return null;
  const completed = normalized.filter((activity) => activity !== current && activity.state === "completed");
  const canExpand = completed.length > 0;

  return (
    <section className={`chat-activity-timeline${compact ? " is-compact" : ""}`} aria-label="Mabaso AI activity">
      {expanded && completed.length ? (
        <div className="chat-activity-completed" aria-hidden="true">
          {completed.slice(-3).map((activity) => (
            <div key={activity.activityType} className="chat-activity-row is-completed">
              <ActivityIcon state="completed" />
              <span>{activity.displayText}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className={`chat-activity-row is-${current.state}`} role="status" aria-live="polite" aria-atomic="true">
        <ActivityIcon state={current.state} />
        <span>{current.displayText}</span>
        {canExpand ? (
          <button
            type="button"
            className="chat-activity-expand"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide completed activity" : "Show completed activity"}
          >
            {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
        ) : null}
      </div>
    </section>
  );
}
