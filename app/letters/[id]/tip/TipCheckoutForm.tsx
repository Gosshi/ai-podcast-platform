"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const AMOUNTS = [200, 500, 1000] as const;

type CheckoutApiResponse =
  | {
      ok: true;
      url: string;
    }
  | {
      ok: false;
      error: string;
    };

type TipCheckoutFormProps = {
  letterId: string;
};

export default function TipCheckoutForm({ letterId }: TipCheckoutFormProps) {
  const [amount, setAmount] = useState<number>(500);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const buttonLabel = useMemo(() => {
    if (isSubmitting) {
      return "決済ページへ移動中...";
    }
    return `${amount}円で支払う`;
  }, [amount, isSubmitting]);

  const onStartCheckout = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          letter_id: letterId,
          amount
        })
      });

      const payload = (await response.json().catch(() => null)) as CheckoutApiResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        setErrorMessage("決済の開始に失敗しました。時間をおいて再度お試しください。");
        return;
      }

      window.location.href = payload.url;
    } catch {
      setErrorMessage("決済の開始に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: "720px" }}>
      <h1>このお便りを優先で読んでほしい</h1>
      <p>
        チップ支払いを行うと、このお便りは優先候補として扱われます。決済完了後は webhook
        を通じて自動でお便りに紐付きます。
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <p>金額を選択してください。</p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          {AMOUNTS.map((candidate) => {
            const selected = amount === candidate;
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => setAmount(candidate)}
                disabled={isSubmitting}
                aria-pressed={selected}
                style={{
                  padding: "0.5rem 0.9rem",
                  borderRadius: "8px",
                  border: selected ? "2px solid #111" : "1px solid #bbb",
                  background: selected ? "#f0f4ff" : "#fff",
                  fontWeight: selected ? 700 : 500
                }}
              >
                {candidate}円
              </button>
            );
          })}
        </div>
      </section>

      {errorMessage ? (
        <p role="alert" style={{ color: "#b00020", marginTop: "1rem" }}>
          {errorMessage}
        </p>
      ) : null}

      <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={onStartCheckout} disabled={isSubmitting}>
          {buttonLabel}
        </button>
        <Link href="/letters">お便り一覧へ戻る</Link>
      </div>
    </main>
  );
}
