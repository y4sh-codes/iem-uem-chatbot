import { pool } from './db';

export interface RightPanelSlide {
  title: string;
  subtitle: string;
  details: string;
}

export interface EventSlide {
  title: string;
  subtitle: string;
  image_url: string;
}

export interface KioskContent {
  top_ticker: string[];
  bottom_ticker: string[];
  events: EventSlide[];
  right_slides?: RightPanelSlide[];
}

const defaultContent: KioskContent = {
  top_ticker: [
    "NAAC A+ Accredited Institution",
    "Ranked among Top Engineering Colleges in Eastern India — NIRF 2025",
    "ISO 9001:2015 Certified",
  ],
  bottom_ticker: [
    "Placement Drive: TCS, Infosys, Wipro on campus this week",
    "Annual Tech Fest 'Concept 2026' registrations now open",
  ],
  events: [
    { 
      title: "Guest Lecture: AI in Modern Engineering", 
      subtitle: "Auditorium Hall 2 · 11:00 AM – 1:00 PM", 
      image_url: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=1600&auto=format&fit=crop" 
    }
  ],
  right_slides: [
    {
      title: "UPCOMING EVENTS",
      subtitle: "Join us for our next big activities",
      details: "IEM-UEM Group constantly organizes tech fests, cultural programs, and placement drives to ensure all-around development."
    }
  ]
};

export async function getContent(): Promise<KioskContent> {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT data FROM kiosk_content WHERE id = 1');
    if (res.rows.length > 0) {
      const parsed = res.rows[0].data;
      // Migration for older format (just in case)
      if (parsed.event && !parsed.events) {
        parsed.events = [{
          title: parsed.event.title || "",
          subtitle: parsed.event.subtitle || "",
          image_url: (parsed.event.image_urls && parsed.event.image_urls.length > 0) ? parsed.event.image_urls[0] : ""
        }];
        delete parsed.event;
      }
      return parsed as KioskContent;
    }
    return defaultContent;
  } catch (err) {
    console.error("Error reading from kiosk_content table:", err);
    return defaultContent;
  } finally {
    client.release();
  }
}

export async function saveContent(content: KioskContent): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO kiosk_content (id, data) 
      VALUES (1, $1) 
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data
    `, [content]);
  } catch (err) {
    console.error("Error writing to kiosk_content table:", err);
    throw err;
  } finally {
    client.release();
  }
}
