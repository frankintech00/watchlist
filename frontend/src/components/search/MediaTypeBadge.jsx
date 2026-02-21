function MediaTypeBadge({ mediaType }) {
  const labels = { movie: 'FILM', tv: 'TV', person: 'PERSON' }
  const label = labels[mediaType]
  if (!label) return null

  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-white">
      {label}
    </span>
  )
}

export default MediaTypeBadge
