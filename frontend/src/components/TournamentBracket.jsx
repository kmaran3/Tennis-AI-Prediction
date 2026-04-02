// Renders a visual tournament bracket from the simulation API response.
// Props:
//   rounds    — array of round arrays. rounds[0] = first round match results.
//   champion  — string: the tournament winner's name
//   isLoading — boolean: show spinner while simulation is running
export default function TournamentBracket({ rounds, champion, isLoading }) {

  // Show spinner while the API is running
  if (isLoading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-4 animate-bounce">🎾</div>
        <p className="font-medium">Simulating tournament...</p>
        <p className="text-sm mt-2">
          Each match requires an AI call — this may take a minute or two.
        </p>
      </div>
    )
  }

  // Show empty state before simulation runs
  if (!rounds || rounds.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Add players and click Simulate to see the bracket.</p>
      </div>
    )
  }

  // Round labels — shows the most descriptive label for each round
  const ROUND_LABELS = ['R32', 'R16', 'Quarterfinals', 'Semifinals', 'Final']
  const labelOffset = ROUND_LABELS.length - rounds.length

  return (
    // Horizontal scroll handles large brackets on small screens
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max items-start">

        {/* Each column = one round */}
        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="flex flex-col gap-3" style={{ minWidth: 170 }}>

            {/* Round label at the top */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center pb-1">
              {ROUND_LABELS[roundIndex + labelOffset] || `Round ${roundIndex + 1}`}
            </p>

            {/* Each match card in this round */}
            {round.map((match, matchIndex) => (
              <div
                key={matchIndex}
                className="bg-white border border-gray-100 rounded-xl shadow-sm p-3 text-sm"
              >
                {/* Player A row */}
                <div className={`py-1 px-2 rounded mb-1 truncate ${
                  match.predicted_winner === match.player_a
                    ? 'bg-green-50 text-green-800 font-bold'
                    : 'text-gray-400 line-through'
                }`}>
                  {match.player_a || '—'}
                </div>

                <div className="text-center text-xs text-gray-300 my-0.5">vs</div>

                {/* Player B row */}
                <div className={`py-1 px-2 rounded truncate ${
                  match.predicted_winner === match.player_b
                    ? 'bg-green-50 text-green-800 font-bold'
                    : 'text-gray-400 line-through'
                }`}>
                  {match.player_b || '—'}
                </div>

                {/* Win probability shown at bottom of card */}
                {match.win_probability && (
                  <div className="text-xs text-gray-400 text-center mt-2">
                    {(match.win_probability * 100).toFixed(0)}% confidence
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Champion trophy column — shown after simulation completes */}
        {champion && (
          <div className="flex flex-col items-center justify-center min-w-[140px] pt-8">
            <div className="text-4xl mb-2">🏆</div>
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 text-center shadow">
              <p className="text-xs text-yellow-600 font-bold uppercase tracking-wide">Champion</p>
              <p className="font-bold text-gray-900 text-sm mt-1 leading-tight">{champion}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
