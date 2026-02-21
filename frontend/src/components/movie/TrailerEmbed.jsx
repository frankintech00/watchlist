function TrailerEmbed({ videoKey }) {
  if (!videoKey) {
    return null
  }

  return (
    <div>
      <h2 className="text-2xl font-heading mb-4">Trailer</h2>
      <div className="aspect-video bg-dark-card rounded-lg overflow-hidden">
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${videoKey}`}
          title="Movie Trailer"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      </div>
    </div>
  )
}

export default TrailerEmbed
