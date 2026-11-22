import { cn } from "@/lib/utils";

/**
 * The logo of Lumen: a square of ink with a ring of rays.
 *
 * It is the same mark everywhere: the public site, the login and the
 * panel of every role. It is decorative: the name of the brand travels
 * next to it as text.
 *
 * The square takes the colour of its surroundings (`currentColor`) and
 * the rays are cut out in the colour of the surface that holds it.
 * That colour is `--brand-cut`: the background of the site by default,
 * and the rail of the panel where the logo sits on a dark surface.
 */
export function BrandLogo({
  className = "",
  cutClassName = "",
}: {
  className?: string;
  cutClassName?: string;
}) {
  return (
    <svg
      viewBox="0 0 30 30"
      aria-hidden="true"
      focusable="false"
      className={cn("size-[30px] shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="30" height="30" fill="currentColor" />
      <circle
        cx="15"
        cy="15"
        r="4.2"
        className={cn("fill-[var(--brand-cut,var(--bg))]", cutClassName)}
      />
      <g
        className={cn("stroke-[var(--brand-cut,var(--bg))]", cutClassName)}
        strokeWidth="1.4"
        strokeLinecap="square"
      >
        <path d="M15 2.6v3.4M15 24v3.4M2.6 15h3.4M24 15h3.4" />
        <path d="M6.1 6.1l2.4 2.4M21.5 21.5l2.4 2.4M23.9 6.1l-2.4 2.4M8.5 21.5l-2.4 2.4" />
      </g>
    </svg>
  );
}
