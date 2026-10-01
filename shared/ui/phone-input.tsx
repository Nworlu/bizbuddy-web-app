"use client";

import { useEffect, useId, useState } from "react";
import { COUNTRIES, dialLabel, flagEmoji } from "@/shared/lib/countries";
import { displayPhone, normalizePhone, phoneFromParts, splitPhone } from "@/shared/lib/phone";

type PhoneInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  hasError?: boolean;
  autoComplete?: string;
};

/** Nigeria only for now: fixed +234 calling code and national number field. */
export function PhoneInput({ id, value, onChange, readOnly, placeholder, hasError, autoComplete = "tel" }: PhoneInputProps) {
  const listId = useId();
  const country = COUNTRIES[0];
  const initial = splitPhone(value);
  const [national, setNational] = useState(initial.national);

  useEffect(() => {
    setNational(splitPhone(value).national);
  }, [value]);

  function onNationalChange(nextNational: string) {
    setNational(nextNational);
    const e164 = phoneFromParts(country.dialCode, nextNational);
    onChange(e164 ?? nextNational.trim());
  }

  const fieldClass = `min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:ring-2 read-only:bg-stone-50 read-only:text-ink-muted ${
    hasError ? "border-rose-400 focus:ring-rose-200" : "border-stone-200 focus:border-brand-700 focus:ring-brand-200"
  }`;

  const prefixClass = `flex shrink-0 items-center gap-1.5 rounded-xl border bg-stone-50 px-3 py-3 text-sm font-medium text-ink ${
    hasError ? "border-rose-400" : "border-stone-200"
  }`;

  const preview = normalizePhone(value) ? displayPhone(normalizePhone(value)!) : null;

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className={prefixClass} aria-hidden={readOnly}>
          <span>{flagEmoji(country.iso)}</span>
          <span>{dialLabel(country)}</span>
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          value={national}
          onChange={(e) => onNationalChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder ?? "e.g. 0803 123 4567"}
          className={fieldClass}
          aria-invalid={hasError}
          aria-describedby={preview ? `${listId}-hint` : undefined}
        />
      </div>
      {preview && (
        <p id={`${listId}-hint`} className="text-xs text-ink-muted">
          {dialLabel(country)} · {preview}
        </p>
      )}
    </div>
  );
}
