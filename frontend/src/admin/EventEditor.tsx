import { useRef, useState, useEffect } from "react";
import { resolveImageUrl, type EventSlide, type RightPanelSlide } from "../api";

interface EventEditorProps {
  events: EventSlide[];
  rightSlides: RightPanelSlide[];
  onSave: (events: EventSlide[], rightSlides: RightPanelSlide[]) => Promise<void>;
  onUploadImage: (file: File) => Promise<{ urls: string[] }>;
}

export default function EventEditor({
  events,
  rightSlides: initialRightSlides,
  onSave,
  onUploadImage,
}: EventEditorProps) {
  const [localEvents, setLocalEvents] = useState<EventSlide[]>(events || []);
  const [rightSlides, setRightSlides] = useState<RightPanelSlide[]>(initialRightSlides || []);

  useEffect(() => {
    setLocalEvents(events || []);
  }, [events]);

  useEffect(() => {
    setRightSlides(initialRightSlides || []);
  }, [initialRightSlides]);

  const [saving, setSaving] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await onSave(localEvents, rightSlides);
      setMessage("Saved.");
      setTimeout(() => setMessage(""), 2500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || uploadingIdx === null) return;
    setUploadingIdx(uploadingIdx); // Keep track of which slide is uploading
    setMessage("");
    try {
      const res = await onUploadImage(files[0]);
      if (res.urls && res.urls.length > 0) {
        const newEvents = [...localEvents];
        newEvents[uploadingIdx].image_url = res.urls[0];
        setLocalEvents(newEvents);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to upload image.");
    } finally {
      setUploadingIdx(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUpload = (idx: number) => {
    setUploadingIdx(idx);
    fileInputRef.current?.click();
  };

  const addSlide = () => {
    setLocalEvents([...localEvents, { title: "", subtitle: "", image_url: "" }]);
  };

  const removeSlide = (idx: number) => {
    setLocalEvents(localEvents.filter((_, i) => i !== idx));
  };

  const updateSlide = (idx: number, field: keyof EventSlide, value: string) => {
    const newEvents = [...localEvents];
    newEvents[idx] = { ...newEvents[idx], [field]: value };
    setLocalEvents(newEvents);
  };

  const addRightSlide = () => {
    setRightSlides([...rightSlides, { title: "", subtitle: "", details: "" }]);
  };

  const removeRightSlide = (idx: number) => {
    setRightSlides(rightSlides.filter((_, i) => i !== idx));
  };

  const updateRightSlide = (idx: number, field: keyof RightPanelSlide, value: string) => {
    const newSlides = [...rightSlides];
    newSlides[idx] = { ...newSlides[idx], [field]: value };
    setRightSlides(newSlides);
  };

  return (
    <div className="admin-card">
      <h2 className="admin-card-title">Event Panel (Right Side Slideshow)</h2>
      <p className="admin-card-desc">
        Update the text slides that appear on the right side of the split screen banner.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "24px" }}>
        {rightSlides.map((slide, idx) => (
          <div key={idx} style={{ padding: "16px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <strong>Text Slide {idx + 1}</strong>
              <button 
                className="admin-icon-btn danger" 
                onClick={() => removeRightSlide(idx)}
                title="Remove Slide"
              >
                ✕
              </button>
            </div>
            <label className="admin-label">Panel Title (Large)</label>
            <input
              className="admin-input"
              value={slide.title}
              onChange={(e) => updateRightSlide(idx, 'title', e.target.value)}
              placeholder="e.g. UPCOMING EVENTS"
            />

            <label className="admin-label">Panel Subtitle (Medium)</label>
            <input
              className="admin-input"
              value={slide.subtitle}
              onChange={(e) => updateRightSlide(idx, 'subtitle', e.target.value)}
              placeholder="e.g. Join us for our next big activities"
            />

            <label className="admin-label">Panel Details (Small)</label>
            <textarea
              className="admin-input"
              value={slide.details}
              onChange={(e) => updateRightSlide(idx, 'details', e.target.value)}
              placeholder="e.g. Detailed information about the events..."
              rows={3}
            />
          </div>
        ))}
        
        <div>
          <button className="admin-btn secondary" onClick={addRightSlide}>
            + Add Text Slide
          </button>
        </div>
      </div>

      <h2 className="admin-card-title">Event Banners (Left Side Images)</h2>
      <p className="admin-card-desc">
        Add multiple images and set a specific title/subtitle instruction for each image.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {localEvents.map((slide, idx) => (
          <div key={idx} style={{ padding: "16px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <strong>Image Slide {idx + 1}</strong>
              <button 
                className="admin-icon-btn danger" 
                onClick={() => removeSlide(idx)}
                title="Remove Slide"
              >
                ✕
              </button>
            </div>
            
            <div className="event-editor-image-row">
              <div className="event-editor-preview">
                {slide.image_url ? (
                  <img src={resolveImageUrl(slide.image_url)} alt={`Slide ${idx + 1}`} />
                ) : (
                  <div className="event-editor-preview-empty">No image</div>
                )}
              </div>
              <div>
                <button
                  className="admin-btn secondary"
                  onClick={() => triggerUpload(idx)}
                  disabled={uploadingIdx === idx}
                >
                  {uploadingIdx === idx ? "Uploading..." : "Upload Image"}
                </button>
              </div>
            </div>

            <label className="admin-label">Title</label>
            <input
              className="admin-input"
              value={slide.title}
              onChange={(e) => updateSlide(idx, "title", e.target.value)}
              placeholder="e.g. Welcome to IEM-UEM"
            />

            <label className="admin-label">Subtitle</label>
            <input
              className="admin-input"
              value={slide.subtitle}
              onChange={(e) => updateSlide(idx, "subtitle", e.target.value)}
              placeholder="e.g. Empowering the future engineers"
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: "16px" }}>
        <button className="admin-btn secondary" onClick={addSlide}>
          + Add Image Slide
        </button>
      </div>

      <div className="admin-card-footer" style={{ marginTop: "24px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
        <button className="admin-btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save All Slides"}
        </button>
        {message && <span className="admin-saved-message">{message}</span>}
      </div>
    </div>
  );
}
