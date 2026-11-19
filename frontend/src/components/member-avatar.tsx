// =============================================================================
// The member avatar.
// -----------------------------------------------------------------------------
// One component for "the picture of a person in the school": the photo
// when the member has one, their initials when they do not. Every list
// of people uses it, so a teacher looks the same everywhere.
// =============================================================================

import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
} as const;

export type MemberAvatarProps = {
  /** The person's name: it is the fallback and the alt text. */
  name: string;
  /** The photo URL, when the person uploaded one. */
  avatarUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
};

/** The first letters of the first two words of a name. */
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function MemberAvatar({ name, avatarUrl, size = "md", className }: MemberAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Foto de ${name}`}
        className={cn(
          "shrink-0 rounded-full object-cover ring-1 ring-border",
          SIZES[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary",
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
