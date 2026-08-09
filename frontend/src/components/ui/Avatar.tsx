import { pieColors } from '../charts/chartTheme';

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: number;
}

/** Deterministic colored initials avatar, used wherever an institution/asset
 * has no logo (Finary-style account rows). */
export function Avatar({ name, size = 32 }: AvatarProps) {
  const color = pieColors[hashString(name) % pieColors.length];

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {initials(name)}
    </div>
  );
}
