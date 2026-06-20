import { STRINGS as S } from "../_data/strings";

export function Footer() {
  return (
    <footer className="foot">
      <p className="foot__copy">{S.footer.tagline}</p>
      <p className="foot__note mono dim">{S.footer.engine}</p>
    </footer>
  );
}
