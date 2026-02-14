import { useState, useEffect } from "react";
import familyPhoto from "../assets/family.png";

interface WelcomeProps {
  onBegin: () => void;
}

export default function Welcome({ onBegin }: WelcomeProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Small delay so the browser paints the small version first,
    // then triggers the CSS transition to expanded
    const timer = setTimeout(() => setExpanded(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="welcome">
      <div className={`welcome-photo-wrap ${expanded ? "expanded" : ""}`}>
        <img
          src={familyPhoto}
          alt="Family"
          className="welcome-photo"
        />
      </div>

      <div className={`welcome-gradient ${expanded ? "expanded" : ""}`} />

      <div className={`welcome-bottom ${expanded ? "expanded" : ""}`}>
        <h1 className="welcome-name">Anya</h1>
        <p className="welcome-tagline">Your speech practice companion</p>
        <button className="btn btn-begin" onClick={onBegin}>
          Begin
        </button>
      </div>
    </div>
  );
}
