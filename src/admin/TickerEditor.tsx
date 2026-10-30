import { useState } from "react";

interface TickerEditorProps {
  title: string;
  description: string;
  items: string[];
  onSave: (items: string[]) => Promise<void>;
}

export default function TickerEditor({ title, description, items, onSave }: TickerEditorProps) {
  const [localItems, setLocalItems] = useState<string[]>(items);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    setLocalItems((prev) => [...prev, trimmed]);
    setNewItem("");
  };

  const removeItem = (index: number) => {
    setLocalItems((prev) => prev.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    setLocalItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateItem = (index: number, value: string) => {
    setLocalItems((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMessage("");
    try {
      await onSave(localItems);
      setSavedMessage("Saved.");
      setTimeout(() => setSavedMessage(""), 2500);
    } catch (err) {
      setSavedMessage(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card-title">{title}</h2>
      <p className="admin-card-desc">{description}</p>

      <div className="ticker-editor-list">
        {localItems.map((item, i) => (
          <div className="ticker-editor-row" key={i}>
            <span className="ticker-editor-index">{i + 1}</span>
            <input
              className="admin-input"
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
            />
            <div className="ticker-editor-actions">
              <button className="admin-icon-btn" onClick={() => moveItem(i, -1)} disabled={i === 0} title="Move up">
                ↑
              </button>
              <button
                className="admin-icon-btn"
                onClick={() => moveItem(i, 1)}
                disabled={i === localItems.length - 1}
                title="Move down"
              >
                ↓
              </button>
              <button className="admin-icon-btn danger" onClick={() => removeItem(i)} title="Remove">
                ✕
              </button>
            </div>
          </div>
        ))}
        {localItems.length === 0 && <p className="admin-empty">No items yet -- add one below.</p>}
      </div>

      <div className="ticker-editor-add-row">
        <input
          className="admin-input"
          placeholder="Add a new item..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
        />
        <button className="admin-btn secondary" onClick={addItem}>
          Add
        </button>
      </div>

      <div className="admin-card-footer">
        <button className="admin-btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {savedMessage && <span className="admin-saved-message">{savedMessage}</span>}
      </div>
    </div>
  );
}
