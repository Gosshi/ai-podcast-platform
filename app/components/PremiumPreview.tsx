import TrackedLink from "@/app/components/TrackedLink";
import styles from "./premium-preview.module.css";

type PremiumPreviewProps = {
  /** Placeholder items to show blurred: [{ label, value }] */
  placeholders: { label: string; value: string }[];
  /** Short message shown on overlay */
  message?: string;
  /** Analytics page identifier */
  page: string;
  /** Analytics source identifier */
  source: string;
};

type PremiumPreviewInlineProps = {
  /** Short message for inline hint */
  message: string;
  /** Analytics page identifier */
  page: string;
  /** Analytics source identifier */
  source: string;
};

const LockSvg = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/**
 * Shows blurred placeholder content with an overlay prompting upgrade.
 * Used to replace `{isPaid ? (...) : null}` patterns so free users
 * see a teaser of what they're missing.
 */
export default function PremiumPreview({
  placeholders,
  message = "有料版で詳細が確認できます",
  page,
  source
}: PremiumPreviewProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.blurredContent} aria-hidden="true">
        <dl>
          {placeholders.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={styles.overlay}>
        <LockSvg className={styles.lockIcon} />
        <p className={styles.overlayText}>{message}</p>
        <TrackedLink
          href="/account"
          className={styles.overlayLink}
          eventName="subscribe_cta_click"
          eventProperties={{ page, source }}
        >
          プランを見る
        </TrackedLink>
      </div>
    </div>
  );
}

/**
 * Compact inline variant: shows a single-line hint with lock icon.
 * Good for tight spaces like card metadata rows.
 */
export function PremiumPreviewInline({
  message,
  page,
  source
}: PremiumPreviewInlineProps) {
  return (
    <div className={styles.inline}>
      <LockSvg className={styles.inlineLockIcon} />
      <p className={styles.inlineText}>{message}</p>
      <TrackedLink
        href="/account"
        className={styles.inlineLink}
        eventName="subscribe_cta_click"
        eventProperties={{ page, source }}
      >
        プランを見る
      </TrackedLink>
    </div>
  );
}
