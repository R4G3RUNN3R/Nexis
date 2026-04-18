import { useState } from "react";
import CielOrb from "./CielOrb";
import CielDialogue from "./CielDialogue";
import { useCiel } from "../../hooks/useCiel";
import "../../styles/ciel.css";

export default function Ciel() {
  const [position, setPosition] = useState({
    x: typeof window !== "undefined" ? window.innerWidth - 96 : 1200,
    y: typeof window !== "undefined" ? window.innerHeight - 120 : 700,
  });

  const {
    pathname,
    open,
    latestMessage,
    messages,
    openCiel,
    closeCiel,
    clearMessages,
    ask,
  } = useCiel();

  return (
    <>
      <CielOrb
        position={position}
        onMove={setPosition}
        onClick={open ? closeCiel : openCiel}
        title="CIEL"
      />

      <CielDialogue
        open={open}
        position={position}
        pathname={pathname}
        latestMessage={latestMessage}
        messages={messages}
        onClose={closeCiel}
        onClear={clearMessages}
        onAsk={(question) => ask(question)}
      />
    </>
  );
}
