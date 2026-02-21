function FilterTabs({ activeFilter, onFilterChange, mediaType }) {
  const filters = [
    { id: 'watching',   label: 'Watching' },
    { id: 'to-watch',   label: 'To Watch' },
    { id: 'watched',    label: 'Watched' },
    { id: 'favourited', label: 'Favourites' },
    { id: 'all',        label: 'All' },
  ].filter(f => !(mediaType === 'films' && f.id === 'watching'))

  return (
    <div className="flex gap-6 mb-6 border-b border-[#2a2a2a]">
      {filters.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onFilterChange(id)}
          className={`pb-3 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px ${
            activeFilter === id
              ? 'text-white border-primary'
              : 'text-[#999] border-transparent hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default FilterTabs
