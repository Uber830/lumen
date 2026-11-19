import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Password input with a show/hide eye toggle on the right edge.
 *
 * The visibility state is local to the component, so the consumer does
 * not have to wire any state for it. The component is a drop-in
 * replacement for a regular <input type="password" />, including
 * ref forwarding.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, id, ...rest }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          {...rest}
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          className={cn(
            "w-full rounded-lg border border-input bg-card pr-11 pl-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring",
            className,
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contrasena" : "Mostrar contrasena"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:text-foreground"
        >
          {visible ? (
            <EyeOff className="size-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <Eye className="size-4" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
    );
  },
);
