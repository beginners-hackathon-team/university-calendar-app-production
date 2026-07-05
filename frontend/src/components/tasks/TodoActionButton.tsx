export function TodoActionButton({
  children,
  onClick,
  onPointerDown,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
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
        border: '1px solid var(--c-border)',
        background: '#fff',
        color: 'var(--c-text-2)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
