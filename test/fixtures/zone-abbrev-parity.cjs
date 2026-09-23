/**
 * (instant, zone) → expected short-zone-abbrev parity table.
 *
 * This repo and a downstream consumer that vendors this widget each run an INDEPENDENT `Intl`
 * self-check over THIS SAME table (there: `workers/embed/test/fixtures/
 * zone-abbrev-parity.ts`). The two repos can't import each other, so the rows
 * are kept identical by convention: if you add/edit/remove a row here, make
 * the same edit in the sibling table in the same change.
 *
 * ── THE SHAPE OF THE LITERAL BELOW IS LOAD-BEARING ───────────────────────────
 * The downstream consumer's `scripts/copy-already-cal.js` fetches THIS FILE from
 * `main` at vendor-bump time and regex-parses the array literal
 * (`scripts/zone-abbrev-parity.js`) to detect the two tables drifting apart.
 * That parser requires:
 *   - an array literal assigned to the name ZONE_ABBREV_CASES, terminated
 *     by a closing bracket + semicolon
 *   - rows of the form { instant: ..., zone: ..., abbrev: ... }
 *   - DOUBLE-quoted strings, in that field order (instant, zone, abbrev)
 *
 * (Those bullets deliberately avoid spelling out the assignment verbatim: the
 * parser's array-literal regex is non-greedy and would otherwise latch onto
 * the example in this very comment and parse zero rows.)
 *
 * Failure semantics on the sibling's side (`copy-already-cal.js`):
 *   - fetched OK but the literal won't parse (const renamed, fields reordered,
 *     single quotes, table deleted from the file) → the bump FAILS HARD. That
 *     is deliberate: receiving the bytes and not finding the table is much
 *     closer to confirmed drift than to a transient outage.
 *   - rows differ between the two repos → the bump FAILS HARD.
 *   - the file can't be fetched at all (network error, or this path 404s and
 *     the legacy fallback path is gone too) → WARNING, and the bump proceeds
 *     unverified. That is the one remaining fail-open case, so deleting or
 *     relocating this file is the one reshape that can go unnoticed.
 * Coordinate any reshape of this literal — and especially of this file's PATH —
 * with a matching change to the downstream consumer's `copy-already-cal.js` in the same
 * window. (`--skip-parity-check` is the documented escape hatch there.)
 *
 * The rows deliberately cover three DIFFERENT abbreviation SHAPES, because
 * each renders differently in the ` · {time} {abbrev}` suffix:
 *   - three-letter CLDR names (EDT/EST/CDT/UTC)
 *   - whole-hour GMT offsets (`GMT+12`) — not every zone has a three-letter
 *     CLDR short name; many render as a raw offset instead
 *   - sub-hour GMT offsets (`GMT+5:30`), which carry a colon and are the
 *     widest label the suffix has to accommodate
 * Keep at least one of each so a parity check can't pass on US-only
 * (or whole-hour-only) assumptions.
 */
const ZONE_ABBREV_CASES = [
  { instant: "2026-07-15T15:00:00Z", zone: "America/New_York", abbrev: "EDT" },
  { instant: "2026-01-15T15:00:00Z", zone: "America/New_York", abbrev: "EST" },
  { instant: "2026-07-15T15:00:00Z", zone: "America/Chicago", abbrev: "CDT" },
  { instant: "2026-07-15T15:00:00Z", zone: "UTC", abbrev: "UTC" },
  {
    instant: "2026-07-15T15:00:00Z",
    zone: "Pacific/Auckland",
    abbrev: "GMT+12",
  },
  { instant: "2026-07-15T15:00:00Z", zone: "Asia/Kolkata", abbrev: "GMT+5:30" },
];

module.exports = { ZONE_ABBREV_CASES };
