import { useEffect } from "react";

const STORE_URL = import.meta.env.VITE_EXTENSION_STORE_URL as string | undefined;

interface Props {
  onDismiss: () => void;
}

export default function ExtensionModal({ onDismiss }: Props) {
  // Escキーで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onDismiss]);

  // モーダル表示中はbodyスクロールを止める
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ext-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(15, 17, 23, 0.5)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "440px",
          background: "#FFFFFF",
          borderRadius: "20px",
          padding: "36px 32px 32px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {/* 閉じるボタン */}
        <button
          onClick={onDismiss}
          aria-label="閉じる"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            border: "none",
            background: "#F4F4F4",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#888",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#EAEAEA"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#F4F4F4"; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        {/* 見出し */}
        <h2
          id="ext-modal-title"
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "#0F1117",
            lineHeight: 1.35,
            marginBottom: "12px",
            letterSpacing: "-0.02em",
          }}
        >
          Chrome拡張機能を追加してください
        </h2>

        {/* 本文 */}
        <p
          style={{
            fontSize: "14px",
            color: "#4A5568",
            lineHeight: 1.7,
            marginBottom: "28px",
          }}
        >
          KU Calendarを利用するには、金沢大学ポータル・WebClass LMSと連携するためのChrome拡張機能が必要です。拡張機能を追加すると、履修情報や課題情報をワンクリックで同期できます。
        </p>

        {/* メインボタン */}
        {STORE_URL ? (
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "14px 20px",
              background: "#4B82F5",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: "15px",
              borderRadius: "12px",
              textDecoration: "none",
              letterSpacing: "-0.01em",
              transition: "background 0.1s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#3A70E2"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#4B82F5"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="white" fillOpacity="0.25"/>
              <path d="M12 8v8M8 12h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Chrome拡張機能を追加する
          </a>
        ) : (
          <div style={{ textAlign: "center" }}>
            <button
              disabled
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                padding: "14px 20px",
                background: "#E8EBF0",
                color: "#9AA5B4",
                fontWeight: 700,
                fontSize: "15px",
                borderRadius: "12px",
                border: "none",
                cursor: "not-allowed",
                letterSpacing: "-0.01em",
              }}
            >
              Chrome拡張機能を追加する
            </button>
            <p style={{ fontSize: "12px", color: "#9AA5B4", marginTop: "8px" }}>
              現在準備中です
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
