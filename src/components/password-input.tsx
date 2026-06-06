"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type CSSProperties, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", disabled, style, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputStyle: CSSProperties = { ...style, paddingRight: "3.5rem" };

  return (
    <div className="relative w-full">
      <input
        {...props}
        disabled={disabled}
        type={showPassword ? "text" : "password"}
        className={className}
        style={inputStyle}
      />
      <button
        type="button"
        aria-label={showPassword ? "Hide password" : "Show password"}
        aria-pressed={showPassword}
        disabled={disabled}
        onClick={() => setShowPassword((visible) => !visible)}
        className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-zinc-700 transition hover:bg-zinc-100 hover:text-black focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
      >
        {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
}
