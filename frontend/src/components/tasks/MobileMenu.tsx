export function MobileMenu({
  children,
  onClick,
  onPointerDown,
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler;
  onPointerDown?: React.PointerEventHandler;
}) {
  return (
    <div
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={{
        marginTop: 6,
        marginLeft: -10,
        marginRight: -10,
        marginBottom: -6,
        borderTop: '1px solid var(--c-border)',
      }}
    >
      {children}
    </div>
  );
}

export function MobileMenuItem({
  children,
  onClick,
  onPointerDown,
  leading,
  trailing,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  leading?: string;
  trailing?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onClick={onClick}
      className="text-[14px] font-medium"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderTop: '1px solid var(--c-border)',
        color: danger ? 'var(--c-danger)' : 'var(--c-text-1)',
        cursor: 'pointer',
      }}
    >
      {leading && (
        <span style={{ fontSize: 13, opacity: 0.55, fontWeight: 400 }}>{leading}</span>
      )}
      {children}
      {trailing && (
        <span style={{ fontSize: 13, opacity: 0.45, fontWeight: 400 }}>{trailing}</span>
      )}
    </button>
  );
}
