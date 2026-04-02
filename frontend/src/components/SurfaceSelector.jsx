// Props:
//   value     — currently selected surface ("Hard", "Clay", or "Grass")
//   onChange  — called with the new surface when user clicks a button
export default function SurfaceSelector({ value, onChange }) {
  const surfaces = [
    { label: 'Hard',  bg: 'bg-blue-500',   ring: 'ring-blue-600'   },
    { label: 'Clay',  bg: 'bg-orange-500', ring: 'ring-orange-600' },
    { label: 'Grass', bg: 'bg-green-500',  ring: 'ring-green-600'  },
  ]

  return (
    <div className="flex gap-3">
      {surfaces.map(({ label, bg, ring }) => (
        <button
          key={label}
          onClick={() => onChange(label)}
          // Active button gets a ring and slight scale; inactive is dimmed
          className={`px-5 py-2 rounded-full text-white text-sm font-semibold
                      transition-all duration-150 ${bg} ${
            value === label
              ? `ring-2 ${ring} ring-offset-1 scale-105 shadow-md`
              : 'opacity-60 hover:opacity-90'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
