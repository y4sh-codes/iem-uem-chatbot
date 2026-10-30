import "./Ticker.css";

interface TickerProps {
  items: string[];
  position: "top" | "bottom";
}

export default function Ticker({ items, position }: TickerProps) {
  let loopItems: string[] = [];
  
  if (items && items.length > 0) {
    let baseItems = [...items];
    while (baseItems.length < 15) {
      baseItems = [...baseItems, ...items];
    }
    loopItems = [...baseItems, ...baseItems];
  }

  return (
    <div className={`ticker ticker-${position}`}>
      {position === "bottom" && <div className="ticker-label">CAMPUS UPDATES</div>}
      <div className="ticker-track-wrapper">
        <div className={`ticker-track ticker-track-${position}`}>
          {loopItems.map((item, i) => (
            <span className="ticker-item" key={i}>
              {item}
              <span className="ticker-dot">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
