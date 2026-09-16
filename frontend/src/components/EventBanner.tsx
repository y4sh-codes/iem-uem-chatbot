import { useState, useEffect } from "react";
import type { EventSlide, RightPanelSlide } from "../api";
import "./EventBanner.css";

interface EventBannerProps {
  events: EventSlide[];
  rightSlides?: RightPanelSlide[];
}

const defaultRightSlides: RightPanelSlide[] = [
  {
    title: "UPCOMING EVENTS",
    subtitle: "Join us for our next big activities",
    details: "IEM-UEM Group constantly organizes tech fests, cultural programs, and placement drives to ensure all-around development."
  }
];

export default function EventBanner({ events, rightSlides: propRightSlides }: EventBannerProps) {
  // LEFT SLIDES
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);

  useEffect(() => {
    setCurrentIndex(0);
    setIsTransitioning(true);
  }, [events]);

  useEffect(() => {
    if (!events || events.length <= 1) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setCurrentIndex((prev) => prev + 1);
    }, 5000); // 5 seconds per slide
    return () => clearInterval(interval);
  }, [events]);

  useEffect(() => {
    if (!events || events.length <= 1) return;
    if (currentIndex === events.length) {
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
        setCurrentIndex(0);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, events]);

  const slidesToRender = events && events.length > 0 ? [...events, events[0]] : [];
  const numSlides = slidesToRender.length > 0 ? slidesToRender.length : 1;

  // RIGHT SLIDES
  const rightSlides = propRightSlides && propRightSlides.length > 0 ? propRightSlides : defaultRightSlides;

  const [rightIndex, setRightIndex] = useState(0);
  const [rightTransitioning, setRightTransitioning] = useState(true);

  useEffect(() => {
    setRightIndex(0);
    setRightTransitioning(true);
  }, [rightSlides]);

  useEffect(() => {
    if (!rightSlides || rightSlides.length <= 1) return;
    const interval = setInterval(() => {
      setRightTransitioning(true);
      setRightIndex((prev) => prev + 1);
    }, 18000); // 18 seconds per slide
    return () => clearInterval(interval);
  }, [rightSlides]);

  useEffect(() => {
    if (!rightSlides || rightSlides.length <= 1) return;
    if (rightIndex === rightSlides.length) {
      const timeout = setTimeout(() => {
        setRightTransitioning(false);
        setRightIndex(0);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [rightIndex, rightSlides]);

  const rightSlidesToRender = rightSlides && rightSlides.length > 0 ? [...rightSlides, rightSlides[0]] : [];
  const numRightSlides = rightSlidesToRender.length > 0 ? rightSlidesToRender.length : 1;

  return (
    <div className="event-banner-container">
      {/* LEFT PART */}
      <div className="event-banner">
        <div 
          className="event-slider-track"
          style={{
            transform: `translateX(-${currentIndex * (100 / numSlides)}%)`,
            width: `${numSlides * 100}%`,
            transition: isTransitioning ? 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
          }}
        >
          {slidesToRender.length > 0 ? (
            slidesToRender.map((slide, idx) => (
              <div 
                className="event-slide-item left-slide-item" 
                key={idx}
                style={{ width: `${100 / numSlides}%` }}
              >
                {slide.image_url && (
                  <img className="event-image" src={slide.image_url} alt={slide.title} />
                )}
                <div className="event-overlay" />
                <div className="event-text">
                  <h1 className="event-title">{slide.title || ""}</h1>
                  <p className="event-subtitle">{slide.subtitle || ""}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="event-slide-item left-slide-item" style={{ width: "100%" }}>
               <div className="event-overlay" />
            </div>
          )}
        </div>
      </div>
      
      {/* RIGHT PART */}
      <div className="event-panel-right">
        <div 
          className="event-slider-track"
          style={{
            transform: `translateX(-${rightIndex * (100 / numRightSlides)}%)`,
            width: `${numRightSlides * 100}%`,
            transition: rightTransitioning ? 'transform 0.8s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
          }}
        >
          {rightSlidesToRender.map((slide, idx) => (
            <div 
              className="event-slide-item right-slide-item" 
              key={idx}
              style={{ width: `${100 / numRightSlides}%` }}
            >
              <div className="event-panel-content">
                <h1 className="event-panel-title">{slide.title}</h1>
                <h2 className="event-panel-subtitle">{slide.subtitle}</h2>
                <h3 className="event-panel-details">{slide.details}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
