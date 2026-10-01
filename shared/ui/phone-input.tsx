"use client";

import { useEffect, useId, useState } from "react";
import { COUNTRIES, dialLabel, flagEmoji, type Country } from "@/shared/lib/countries";
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

export function PhoneInput({ id, value, onChange, readOnly, placeholder, hasError, autoComplete = "tel" }: PhoneInputProps) {
  const listId = useId();
  const initial = splitPhone(value);
  const [country, setCountry] = useState<Country>(initial.country);
  const [national, setNational] = useState(initial.national);

  useEffect(() => {
    const next = splitPhone(value);
    setCountry(next.country);
    setNational(next.national);
  }, [value]);

  function emit(iso: Country, nationalValue: string) {
    const e164 = phoneFromParts(iso.dialCode, nationalValue);
    onChange(e164 ?? nationalValue.trim());
  }

  function onCountryChange(iso: string) {
    const next = COUNTRIES.find((c) => c.iso === iso) ?? country;
    setCountry(next);
    emit(next, national);
  }

  function onNationalChange(nextNational: string) {
    setNational(nextNational);
    emit(country, nextNational);
  }

  const fieldClass = `min-w-0 flex-1 rounded-xl border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:ring-2 read-only:bg-stone-50 read-only:text-ink-muted ${
    hasError ? "border-rose-400 focus:ring-rose-200" : "border-stone-200 focus:border-brand-700 focus:ring-brand-200"
  }`;

  const selectClass = `shrink-0 rounded-xl border bg-white py-3 pl-3 pr-8 text-sm font-medium text-ink outline-none transition focus:ring-2 ${
    hasError ? "border-rose-400 focus:ring-rose-200" : "border-stone-200 focus:border-brand-700 focus:ring-brand-200"
  }`;

  const preview = normalizePhone(value) ? displayPhone(normalizePhone(value)!) : null;

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <label htmlFor={`${id}-country`} className="sr-only">
          Country calling code
        </label>
        <select
          id={`${id}-country`}
          value={country.iso}
          onChange={(e) => onCountryChange(e.target.value)}
          disabled={readOnly}
          className={selectClass}
          aria-describedby={preview ? `${listId}-hint` : undefined}
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {flagEmoji(c.iso)} {c.name} ({dialLabel(c)})
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          value={national}
          onChange={(e) => onNationalChange(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder ?? (country.iso === "NG" ? "e.g. 0803 123 4567" : "Phone number")}
          className={fieldClass}
          aria-invalid={hasError}
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
