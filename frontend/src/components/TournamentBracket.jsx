import { Fragment } from 'react'

// ── Layout constants ─────────────────────────────────────────────────────
const CARD_H  = 68   // height of one match card (px)
const SLOT_H  = 84   // vertical space per match slot in round 0 (card + gap)
const COL_W   = 186  // width of each round column (px)
const CONN_W  = 34   // width of the SVG connector column between rounds

// Labels for up to 7 rounds, indexed from the earliest possible round
const ROUND_LABELS = [
  'Round of 128', 'Round of 64', 'Round of 32',
  'Round of 16', 'Quarterfinals', 'Semifinals', 'Final',
]

// ── Helper: vertical position of match card ──────────────────────────────
// Each round doubles the unit height so cards are centered between their feeders.
function cardTop(roundIdx, matchIdx) {
  const unitH = SLOT_H * (1 << roundIdx)   // SLOT_H * 2^roundIdx
  return matchIdx * unitH + (unitH - CARD_H) / 2
}

// ── SVG connector lines between two adjacent rounds ──────────────────────
function Connectors({ roundIdx, matchCount, totalH }) {
  const segs = []
  for (let j = 0; j < matchCount / 2; j++) {
    // Y-centers of the two cards that feed into match j of the next round
    const y1 = cardTop(roundIdx, 2 * j)     + CARD_H / 2
    const y2 = cardTop(roundIdx, 2 * j + 1) + CARD_H / 2
    const ym = (y1 + y2) / 2  // midpoint → entry point of next round card

    segs.push(
      // Stub right from card 1
      <line key={`a${j}`} x1="0"        y1={y1} x2={CONN_W / 2} y2={y1} stroke="#d1d5db" strokeWidth="1.5" />,
      // Stub right from card 2
      <line key={`b${j}`} x1="0"        y1={y2} x2={CONN_W / 2} y2={y2} stroke="#d1d5db" strokeWidth="1.5" />,
      // Vertical bar connecting both stubs
      <line key={`c${j}`} x1={CONN_W/2} y1={y1} x2={CONN_W / 2} y2={y2} stroke="#d1d5db" strokeWidth="1.5" />,
      // Stub right to next round's card
      <line key={`d${j}`} x1={CONN_W/2} y1={ym} x2={CONN_W}     y2={ym} stroke="#d1d5db" strokeWidth="1.5" />,
    )
  }
  return (
    <svg width={CONN_W} height={totalH} style={{ display: 'block', flexShrink: 0 }}>
      {segs}
    </svg>
  )
}

// ── Single player row inside a match card ────────────────────────────────
function PlayerRow({ name, isWinner, label, loser }) {
  return (
    <div
      className={`flex items-center px-2.5 gap-1.5 ${isWinner ? 'bg-blue-50' : ''}`}
      style={{ height: 33 }}
    >
      <span className={`text-xs truncate flex-1 min-w-0 leading-tight ${
        isWinner  ? 'font-semibold text-gray-900' :
        loser     ? 'text-gray-400'               :
                    'text-gray-600'
      }`}>
        {name || 'TBD'}
      </span>

      {/* Right-side label: score for real results, probability for predictions */}
      {isWinner && label && (
        <span className="text-xs shrink-0 text-blue-600 font-mono tabular-nums">
          {label}
        </span>
      )}
    </div>
  )
}

// ── One match card ────────────────────────────────────────────────────────
function MatchCard({ match, roundIdx, matchIdx }) {
  const top      = cardTop(roundIdx, matchIdx)
  const winner   = match.winner || match.predicted_winner
  const isReal   = !!match.completed   // true if this is an actual played result

  // Determine the label shown next to the winner
  let winLabel = null
  if (isReal && match.score) {
    // Cap score string to keep cards from overflowing
    winLabel = match.score.length > 13 ? match.score.slice(0, 12) + '…' : match.score
  } else if (!isReal && match.win_probability != null) {
    winLabel = `${(match.win_probability * 100).toFixed(0)}%`
  }

  const winA = winner === match.player_a
  const winB = winner === match.player_b

  return (
    <div
      style={{ position: 'absolute', top, height: CARD_H, left: 0, right: 0 }}
      className={`rounded-lg overflow-hidden shadow-sm ${
        isReal
          ? 'border border-gray-200 bg-gray-50'    // completed: muted
          : 'border border-blue-100 bg-white'       // predicted: clean white
      }`}
    >
      <PlayerRow
        name={match.player_a}
        isWinner={winA}
        label={winA ? winLabel : null}
        loser={!isReal && !winA && !!winner}
      />
      <div className="h-px bg-gray-200" />
      <PlayerRow
        name={match.player_b}
        isWinner={winB}
        label={winB ? winLabel : null}
        loser={!isReal && !winB && !!winner}
      />
    </div>
  )
}

// ── Main exported component ───────────────────────────────────────────────
export default function TournamentBracket({
  rounds,
  champion,
  isLoading,
  completedRounds = [],
}) {
  // Loading state
  if (isLoading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-4 animate-bounce">🎾</div>
        <p className="font-medium">Simulating tournament...</p>
        <p className="text-sm mt-2">Each match requires an AI call — this may take a minute.</p>
      </div>
    )
  }

  // Merge completed (real) rounds with predicted rounds
  const allRounds = [...completedRounds, ...(rounds || [])]

  // Empty state
  if (allRounds.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Import or add players, then click Simulate to see the bracket.</p>
      </div>
    )
  }

  const firstRoundMatches = allRounds[0].length
  const totalH            = firstRoundMatches * SLOT_H
  const numCompleted      = completedRounds.length

  // Pick labels that end at "Final" for the last round
  const labels = ROUND_LABELS.slice(Math.max(0, ROUND_LABELS.length - allRounds.length))

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-start" style={{ minWidth: 'max-content' }}>

        {allRounds.map((round, rIdx) => (
          <Fragment key={rIdx}>

            {/* ── Round column ── */}
            <div style={{ width: COL_W }}>

              {/* Round label */}
              <div className="flex items-center justify-center gap-1 pb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {labels[rIdx] || `Round ${rIdx + 1}`}
                </span>
                {rIdx < numCompleted && (
                  <span className="text-xs text-green-500 font-bold" title="Completed">✓</span>
                )}
              </div>

              {/* Cards container */}
              <div style={{ position: 'relative', height: totalH, width: COL_W }}>
                {round.map((match, mIdx) => (
                  <MatchCard
                    key={mIdx}
                    match={match}
                    roundIdx={rIdx}
                    matchIdx={mIdx}
                  />
                ))}
              </div>
            </div>

            {/* ── Connector SVG ── */}
            {rIdx < allRounds.length - 1 && (
              <div style={{ paddingTop: 26, flexShrink: 0 }}>
                <Connectors
                  roundIdx={rIdx}
                  matchCount={round.length}
                  totalH={totalH}
                />
              </div>
            )}

          </Fragment>
        ))}

        {/* ── Champion trophy ── */}
        {champion && (
          <div style={{ paddingTop: 26, paddingLeft: 8 }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center pb-2">
              Winner
            </p>
            <div
              style={{ height: totalH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-center shadow-md">
                <div className="text-3xl mb-1">🏆</div>
                <p className="text-xs text-amber-600 font-bold uppercase tracking-wide">Champion</p>
                <p className="font-bold text-gray-900 text-sm mt-1 leading-tight" style={{ maxWidth: 120 }}>
                  {champion}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
