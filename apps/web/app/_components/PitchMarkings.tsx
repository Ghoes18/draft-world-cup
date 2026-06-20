/**
 * PitchMarkings — the chalk line system behind the hero scorebug.
 *
 * A halfway line splits the fixture into home (left) and away (right); the
 * centre circle sits under the score; the two penalty "D"s frame the edges.
 * Strokes draw in on load like a pitch being lined (disabled under
 * prefers-reduced-motion via the `.draw` class).
 */

function len(value: number): React.CSSProperties {
  return { "--len": value } as React.CSSProperties;
}

export function PitchMarkings() {
  return (
    <svg
      className="hero__markings"
      viewBox="0 0 1000 380"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth="1.5">
        {/* halfway line */}
        <line className="draw" style={len(380)} x1="500" y1="0" x2="500" y2="380" />
        {/* centre circle */}
        <circle className="draw" style={len(600)} cx="500" cy="190" r="92" />
        {/* centre spot */}
        <circle cx="500" cy="190" r="3.5" fill="currentColor" stroke="none" />
        {/* left penalty D */}
        <path className="draw" style={len(360)} d="M 70 90 H 150 V 290 H 70" />
        <path className="draw" style={len(220)} d="M 150 140 A 60 60 0 0 1 150 240" />
        {/* right penalty D */}
        <path className="draw" style={len(360)} d="M 930 90 H 850 V 290 H 930" />
        <path className="draw" style={len(220)} d="M 850 140 A 60 60 0 0 0 850 240" />
      </g>
    </svg>
  );
}
