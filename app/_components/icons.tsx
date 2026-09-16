/* Icons copied from the prototype so the portal and admin console keep the
   exact set the design uses. */
const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconHome = (p: { size?: number }) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} {...stroke}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const IconDoc = (p: { size?: number }) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} {...stroke}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);

export const IconUser = (p: { size?: number }) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} {...stroke}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const IconOut = (p: { size?: number }) => (
  <svg width={p.size ?? 18} height={p.size ?? 18} {...stroke}>
    <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l5 4-5 4M20 12H9" />
  </svg>
);

export const IconDownload = (p: { size?: number }) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} {...stroke}>
    <path d="M12 4v11M7 10l5 5 5-5M4 20h16" />
  </svg>
);

export const IconTrash = (p: { size?: number }) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} {...stroke}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);

export const IconPlus = (p: { size?: number }) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} {...stroke}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMail = (p: { size?: number }) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} {...stroke}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const IconVisa = () => (
  <svg className="cardmark" viewBox="0 0 48 16" aria-label="Card">
    <text
      x="0"
      y="14"
      fontFamily="Arial Black, Arial, sans-serif"
      fontWeight="900"
      fontStyle="italic"
      fontSize="17"
      fill="#1A1F71"
      letterSpacing="-.5"
    >
      VISA
    </text>
  </svg>
);
