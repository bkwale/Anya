import { useState } from "react";
import { type Module } from "./lib/data";
import Welcome from "./components/Welcome";
import Home from "./components/Home";
import Session from "./components/Session";
import Progress from "./components/Progress";

type Screen =
  | { type: "welcome" }
  | { type: "home" }
  | { type: "session"; module: Module }
  | { type: "progress" };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ type: "welcome" });
  const [homeKey, setHomeKey] = useState(0);

  const handleBegin = () => {
    setScreen({ type: "home" });
  };

  const handleStartModule = (module: Module) => {
    setScreen({ type: "session", module });
  };

  const handleFinish = () => {
    setHomeKey((k) => k + 1);
    setScreen({ type: "home" });
  };

  const handleOpenProgress = () => {
    setScreen({ type: "progress" });
  };

  const handleBackFromProgress = () => {
    setHomeKey((k) => k + 1);
    setScreen({ type: "home" });
  };

  if (screen.type === "welcome") {
    return <Welcome onBegin={handleBegin} />;
  }

  if (screen.type === "session") {
    return <Session module={screen.module} onFinish={handleFinish} />;
  }

  if (screen.type === "progress") {
    return <Progress onBack={handleBackFromProgress} />;
  }

  return (
    <Home
      key={homeKey}
      onStartModule={handleStartModule}
      onOpenProgress={handleOpenProgress}
    />
  );
}
