"use client";

import { useMemo, useState } from "react";
import type { Country } from "./countries";
import { parsePhoneField } from "./phone";

/** Country + national number state for {@link PhoneInput}. */
export function usePhoneField(initial = "") {
  const parsed = useMemo(() => parsePhoneField(initial), [initial]);
  const [country, setCountry] = useState<Country>(parsed.country);
  const [national, setNational] = useState(parsed.national);

  return {
    countryIso: country.iso,
    setCountry,
    national,
    setNational,
    dialCode: country.dial,
    reset(next: string) {
      const p = parsePhoneField(next);
      setCountry(p.country);
      setNational(p.national);
    },
  };
}
