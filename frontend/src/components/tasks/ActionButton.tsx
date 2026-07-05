export function ActionButton({
  children,
  onClick,
  onPointerDown,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="text-[11px] font-semibold"
      style={{
        padding: '3px 7px',
        borderRadius: 5,
        border: danger ? 'none' : '1px solid var(--c-border)',
        background: danger ? 'transparent' : '#fff',
        color: danger ? 'var(--c-danger)' : 'var(--c-text-2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
