"use client";

import { useId, type ReactNode } from "react";
import { COUNTRIES, countryByIso, countrySelectLabel, type Country } from "@/shared/lib/countries";

type PhoneInputProps = {
  id?: string;
  countryIso: string;
  onCountryChange: (country: Country) => void;
  national: string;
  onNationalChange: (national: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const fieldClass =
  "w-full min-w-0 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-200 read-only:bg-stone-50 read-only:text-ink-muted disabled:opacity-60";

export function PhoneInput({
  id: idProp,
  countryIso,
  onCountryChange,
  national,
  onNationalChange,
  readOnly,
  disabled,
  className,
  ...aria
}: PhoneInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const country = countryByIso(countryIso);

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <CountrySelect id={`${id}-country`} value={country.iso} onChange={(iso) => onCountryChange(countryByIso(iso))} disabled={disabled || readOnly} />
      <div className="flex min-w-0 flex-1 items-stretch rounded-xl border border-stone-200 bg-white focus-within:border-brand-700 focus-within:ring-2 focus-within:ring-brand-200">
        <span className="flex shrink-0 items-center border-r border-stone-200 px-3 text-sm font-medium text-ink-muted" aria-hidden>
          +{country.dial}
        </span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={national}
          onChange={(e) => onNationalChange(e.target.value)}
          placeholder={country.example}
          readOnly={readOnly}
          disabled={disabled}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm text-ink outline-none"
          {...aria}
        />
      </div>
    </div>
  );
}

function CountrySelect({ id, value, onChange, disabled }: { id: string; value: string; onChange: (iso: string) => void; disabled?: boolean }) {
  return (
    <div className="relative shrink-0">
      <label htmlFor={id} className="sr-only">
        Country
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} w-[7.25rem] appearance-none pr-8 ${disabled ? "" : "cursor-pointer"}`}
      >
        {COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag} {countrySelectLabel(c)}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-ink-muted" aria-hidden>
        ▾
      </span>
    </div>
  );
}

export function PhoneField({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}
