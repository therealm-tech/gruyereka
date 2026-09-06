import type { ReactNode } from "react";
import { CheckIcon } from "@/components/ui/Icon";

/**
 * A radio or a checkbox drawn as a chip. The real input stays in the form,
 * visually hidden rather than replaced, so the choice submits without
 * JavaScript and keyboard focus still lands on it.
 */
export function ChoiceChip({
  name,
  value,
  type,
  checked,
  onChange,
  children,
}: {
  name: string;
  value: string;
  type: "radio" | "checkbox";
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm ${
        checked ? "bg-ink font-medium text-paper" : "border border-rule text-ink-2"
      }`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {children}
      {checked ? <CheckIcon /> : null}
    </label>
  );
}
