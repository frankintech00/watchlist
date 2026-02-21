import MediaCard from './MediaCard'
import ScrollableRow from '../common/ScrollableRow'

function MediaRow({ title, items }) {
  if (!items || items.length === 0) return null

  return (
    <div className="mb-6">
      <h2 className="text-white font-semibold text-base mb-2 px-8 md:px-12">{title}</h2>
      <ScrollableRow>
        <div className="flex gap-3 px-8 md:px-12 pb-40">
          {items.map((item) => {
            const isMovie = item.media_type === 'movie' || item.tmdb_movie_id
            const id = isMovie ? (item.id || item.tmdb_movie_id) : (item.id || item.tmdb_show_id)
            const key = `${item.media_type || (isMovie ? 'movie' : 'tv')}-${id}`

            return (
              <div key={key} className="flex-shrink-0 w-36 md:w-40">
                <MediaCard item={item} />
              </div>
            )
          })}
        </div>
      </ScrollableRow>
    </div>
  )
}

export default MediaRow
