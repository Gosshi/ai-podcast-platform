"use client";

import { useState, type ReactNode } from "react";
import styles from "./collapsible-section.module.css";

type CollapsibleSectionProps = {
  label: string;
  collapsedLabel?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export default function CollapsibleSection({
  label,
  collapsedLabel,
  children,
  defaultOpen = false
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span>{isOpen ? label : (collapsedLabel ?? label)}</span>
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`.trim()}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen ? <div className={styles.content}>{children}</div> : null}
    </div>
  );
}
