"use client";

import { useState } from "react";
import { track } from "@/src/lib/analytics";
import WelcomeTutorial from "./WelcomeTutorial";
import styles from "./welcome-tutorial.module.css";

type TutorialTriggerProps = {
  page: string;
  autoOpen?: boolean;
};

export default function TutorialTrigger({ page, autoOpen = false }: TutorialTriggerProps) {
  const [openCount, setOpenCount] = useState(autoOpen ? 1 : 0);

  const isOpen = openCount > 0;

  const handleOpen = () => {
    track("tutorial_open", {
      page,
      source: "tutorial_trigger_button"
    });
    setOpenCount((c) => c + 1);
  };

  const handleClose = () => {
    setOpenCount(0);
  };

  return (
    <>
      <button
        type="button"
        className={styles.triggerButton}
        onClick={handleOpen}
      >
        <span className={styles.triggerIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M12 16v-4m0-4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </span>
        使い方ガイド
      </button>
      {isOpen ? (
        <WelcomeTutorial key={openCount} page={page} onClose={handleClose} />
      ) : null}
    </>
  );
}
