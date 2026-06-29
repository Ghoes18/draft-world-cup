"use client";

import { useStrings } from "../_i18n/LocaleProvider";

export function Footer() {
  const S = useStrings();
  return (
    <footer className="foot">
      <p className="foot__copy">{S.footer.tagline}</p>
      <p className="foot__note mono dim">{S.footer.engine}</p>
    </footer>
  );
}
