"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type FieldErrors = Partial<Record<"display_name" | "text", string>>;

type ApiResponse =
  | {
      ok: true;
      letter: {
        id: string;
        display_name: string;
        text: string;
        created_at: string;
      };
    }
  | {
      ok: false;
      error: string;
      fields?: FieldErrors;
    };

const DISPLAY_NAME_MAX = 40;
const TEXT_MAX = 700;

const validate = (displayName: string, text: string): FieldErrors => {
  const errors: FieldErrors = {};

  if (!displayName.trim()) {
    errors.display_name = "表示名は必須です";
  } else if (displayName.trim().length > DISPLAY_NAME_MAX) {
    errors.display_name = `表示名は${DISPLAY_NAME_MAX}文字以内で入力してください`;
  }

  if (!text.trim()) {
    errors.text = "お便り本文は必須です";
  } else if (text.trim().length > TEXT_MAX) {
    errors.text = `本文は${TEXT_MAX}文字以内で入力してください`;
  }

  return errors;
};

export default function LettersPage() {
  const [displayName, setDisplayName] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submittedLetterId, setSubmittedLetterId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingText = useMemo(() => TEXT_MAX - text.length, [text.length]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);
    setSubmittedLetterId(null);

    const currentErrors = validate(displayName, text);
    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/letters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          display_name: displayName,
          text
        })
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok || !payload || !payload.ok) {
        const fieldErrors = payload && !payload.ok ? payload.fields : undefined;
        const message = payload && !payload.ok ? payload.error : "submit_failed";
        setErrors(fieldErrors ?? {});

        if (message === "rate_limited") {
          setSubmitError("短時間での連続投稿はできません。しばらく待ってから再投稿してください。");
        } else if (message === "validation_error") {
          setSubmitError("入力内容を確認してください。");
        } else {
          setSubmitError("投稿に失敗しました。時間をおいて再度お試しください。");
        }

        return;
      }

      setDisplayName("");
      setText("");
      setErrors({});
      setSubmittedLetterId(payload.letter.id);
      setSuccessMessage("お便りを受け付けました。ありがとうございます。");
    } catch {
      setSubmitError("投稿に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main>
      <h1>お便り投稿</h1>
      <p>番組への感想・質問・取り上げてほしいテーマを送ってください。</p>

      {successMessage ? (
        <section aria-live="polite">
          <p>{successMessage}</p>
          <p>投げ銭があると優先的に取り上げられる場合があります。</p>
          {submittedLetterId ? (
            <p>
              <Link href={`/letters/${submittedLetterId}/tip`}>このお便りを優先で読んでほしい（チップ支払い）</Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {submitError ? (
        <p role="alert" style={{ color: "#b00020" }}>
          {submitError}
        </p>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        <div style={{ marginBottom: "1rem", maxWidth: "520px" }}>
          <label htmlFor="display_name">表示名</label>
          <input
            id="display_name"
            name="display_name"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={DISPLAY_NAME_MAX}
            aria-invalid={Boolean(errors.display_name)}
            aria-describedby={errors.display_name ? "display_name_error" : undefined}
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.375rem" }}
          />
          {errors.display_name ? (
            <p id="display_name_error" role="alert" style={{ color: "#b00020", marginTop: "0.375rem" }}>
              {errors.display_name}
            </p>
          ) : null}
        </div>

        <div style={{ marginBottom: "1rem", maxWidth: "720px" }}>
          <label htmlFor="text">本文</label>
          <textarea
            id="text"
            name="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={TEXT_MAX}
            rows={8}
            aria-invalid={Boolean(errors.text)}
            aria-describedby={errors.text ? "text_error" : "text_hint"}
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.375rem", resize: "vertical" }}
          />
          <p id="text_hint" style={{ marginTop: "0.375rem", color: "#444" }}>
            残り {remainingText} 文字
          </p>
          {errors.text ? (
            <p id="text_error" role="alert" style={{ color: "#b00020", marginTop: "0.375rem" }}>
              {errors.text}
            </p>
          ) : null}
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "送信中..." : "お便りを送信"}
        </button>
      </form>
    </main>
  );
}
