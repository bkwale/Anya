import familyPhoto from "../assets/family.png";

interface WelcomeProps {
  onBegin: () => void;
}

export default function Welcome({ onBegin }: WelcomeProps) {
  return (
    <div className="welcome">
      <div className="welcome-photo-wrap">
        <img
          src={familyPhoto}
          alt="Family"
          className="welcome-photo"
        />
        <div className="welcome-gradient" />
      </div>

      <div className="welcome-bottom">
        <h1 className="welcome-name">Anya</h1>
        <p className="welcome-tagline">Your speech practice companion</p>
        <button className="btn btn-begin" onClick={onBegin}>
          Begin
        </button>
      </div>
    </div>
  );
}
