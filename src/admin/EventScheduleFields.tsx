import { useId } from "react";
import {
  EVENT_CATEGORIES,
  type EventCategory,
  type RightPanelSlide,
} from "@/lib/api";

type ScheduleValue = Pick<
  RightPanelSlide,
  "category" | "start_date" | "end_date" | "start_time" | "end_time"
>;

interface EventScheduleFieldsProps {
  value: ScheduleValue;
  onChange: (patch: Partial<ScheduleValue>) => void;
}

/**
 * Category, single/range date, and time range controls shared by the direct
 * event editor and the event-admin submission form.
 */
export default function EventScheduleFields({
  value,
  onChange,
}: EventScheduleFieldsProps) {
  const categoryGroupName = useId();

  return (
    <div className="admin-schedule-fields">
      <label className="admin-label">Category</label>
      <div className="admin-radio-group admin-radio-group-inline">
        {EVENT_CATEGORIES.map((category) => (
          <label className="admin-radio" key={category}>
            <input
              type="radio"
              name={categoryGroupName}
              value={category}
              checked={(value.category || "Events") === category}
              onChange={() => onChange({ category: category as EventCategory })}
            />
            {category}
          </label>
        ))}
      </div>

      <div className="admin-form-row">
        <div className="admin-form-field">
          <label className="admin-label">Start date</label>
          <input
            className="admin-input"
            type="date"
            value={value.start_date || ""}
            onChange={(e) => onChange({ start_date: e.target.value || null })}
          />
        </div>
        <div className="admin-form-field">
          <label className="admin-label">End date (optional)</label>
          <input
            className="admin-input"
            type="date"
            value={value.end_date || ""}
            min={value.start_date || undefined}
            onChange={(e) => onChange({ end_date: e.target.value || null })}
          />
          <div className="admin-hint">Leave empty for a single-day event.</div>
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-form-field">
          <label className="admin-label">Start time (optional)</label>
          <input
            className="admin-input"
            type="time"
            value={value.start_time || ""}
            onChange={(e) => onChange({ start_time: e.target.value || null })}
          />
        </div>
        <div className="admin-form-field">
          <label className="admin-label">End time (optional)</label>
          <input
            className="admin-input"
            type="time"
            value={value.end_time || ""}
            onChange={(e) => onChange({ end_time: e.target.value || null })}
          />
        </div>
      </div>

      {(value.start_time || value.end_time) && (
        <div className="admin-time-actions">
          <button
            type="button"
            className="admin-btn secondary admin-clear-time"
            onClick={() => onChange({ start_time: null, end_time: null })}
          >
            Remove time range
          </button>
        </div>
      )}
    </div>
  );
}
