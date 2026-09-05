/**
 * Icons.
 *
 * design-system.md §10: 14–16px、thin monoline、currentColor。
 * 装飾目的の塗り潰しアイコンを増やさない。
 */

type IconProps = { className?: string };

const box = {
  viewBox: "0 0 16 16",
  "aria-hidden": true,
} as const;

export const FileIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="M4 2.5h5l3 3v8H4z" />
    <path d="M9 2.5v3h3" />
  </svg>
);

export const FolderIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="M2.5 4.5h4l1.2 1.5h5.8v7h-11z" />
  </svg>
);

export const ChevronIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="m6 4 4 4-4 4" />
  </svg>
);

export const ChevronDownIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="m4 6 4 4 4-4" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);

export const ArchiveIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="M3 4.5h10v8H3z" />
    <path d="M2.5 2.5h11v2h-11zM6 7h4" />
  </svg>
);

export const SidebarIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <rect x="2" y="2.5" width="12" height="11" rx="1" />
    <path d="M5.5 2.5v11" />
  </svg>
);

export const ContentsIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <circle cx="3.2" cy="4" r=".7" fill="currentColor" stroke="none" />
    <circle cx="3.2" cy="8" r=".7" fill="currentColor" stroke="none" />
    <circle cx="3.2" cy="12" r=".7" fill="currentColor" stroke="none" />
    <path d="M6 4h7M6 8h5.5M6 12h6.3" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <circle cx="7" cy="7" r="4.2" />
    <path d="m10.3 10.3 3 3" />
  </svg>
);

export const MoreIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <circle cx="3.5" cy="8" r=".8" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r=".8" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="8" r=".8" fill="currentColor" stroke="none" />
  </svg>
);

/** Settings は Gear ではなく slider controls（ui-spec.md §2）。 */
export const SettingsIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="M3 4.5h10M3 8h10M3 11.5h10" />
    <circle cx="6" cy="4.5" r="1.25" fill="var(--sidebar)" />
    <circle cx="10.5" cy="8" r="1.25" fill="var(--sidebar)" />
    <circle cx="7.5" cy="11.5" r="1.25" fill="var(--sidebar)" />
  </svg>
);

export const WarningIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="M8 2.5 14.5 13.5h-13z" />
    <path d="M8 6.5v3.2M8 11.6v.6" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
);

export const ArrowUpIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="M8 12.5v-9M4.5 7 8 3.5 11.5 7" />
  </svg>
);

export const ArrowDownIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="M8 3.5v9M4.5 9 8 12.5 11.5 9" />
  </svg>
);

/*
 * Window controls（ADR-010）。
 * Windows の Segoe Fluent Icons に合わせ、線幅 1 / 10px 相当で描く。
 * 他のアイコンより細いのは意図的。ここは chrome であり、内容ではない。
 */

export const MinimizeIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <path d="M3.5 8h9" />
  </svg>
);

export const MaximizeIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <rect x="3.5" y="3.5" width="9" height="9" rx="0.5" />
  </svg>
);

/** 最大化中に出す。前面の小さな窓と、その奥にずれた窓。 */
export const RestoreIcon = ({ className }: IconProps) => (
  <svg {...box} className={className}>
    <rect x="3.5" y="5.5" width="7" height="7" rx="0.5" />
    <path d="M5.5 3.5h7v7" />
  </svg>
);
