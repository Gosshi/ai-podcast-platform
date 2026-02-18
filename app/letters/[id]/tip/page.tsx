import TipCheckoutForm from "./TipCheckoutForm";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function LetterTipPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { status } = await searchParams;

  return (
    <>
      {status === "success" ? (
        <p style={{ color: "#0a7f2e" }} role="status">
          決済が完了しました。反映まで数秒かかる場合があります。
        </p>
      ) : null}
      {status === "cancel" ? (
        <p role="status" style={{ color: "#5c3d00" }}>
          決済はキャンセルされました。再度お試しいただけます。
        </p>
      ) : null}
      <TipCheckoutForm letterId={id} />
    </>
  );
}
