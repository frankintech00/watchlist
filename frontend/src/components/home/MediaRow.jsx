import MediaCard from './MediaCard'
import ScrollableRow from '../common/ScrollableRow'

// Desktop card: md:w-40 (160 px wide) × aspect-ratio 2/3 = 240 px tall.
// Arrow columns are hidden on mobile so cardHeight only affects desktop.
const CARD_HEIGHT = 240

function MediaRow({ title, items }) {
  if (!items || items.length === 0) return null

  return (
    <div className="mb-2 md:mb-6">
      {/* Mobile: px-4 aligns with the pl-4 card indent (no arrow columns).
          Desktop: px-12 matches the w-12 arrow-column width. */}
      <h2 className="text-white font-semibold text-base mb-2 px-4 md:px-12">{title}</h2>
      <ScrollableRow cardHeight={CARD_HEIGHT}>
        {/* Mobile: pl-4 gives a left margin matching the page edge.
            Desktop: pl-0 — the w-12 arrow column provides the gutter.
            pb-40 gives clearance for the card hover-panel below the last card row. */}
        <div className="flex gap-3 pb-5 md:pb-24 pl-4 md:pl-0">
          {items.map((item) => {
            const isMovie = item.media_type === 'movie' || item.tmdb_movie_id
            const id = isMovie ? (item.id || item.tmdb_movie_id) : (item.id || item.tmdb_show_id)
            const key = `${item.media_type || (isMovie ? 'movie' : 'tv')}-${id}`

            return (
              <div key={key} className="flex-shrink-0 w-[30vw] md:w-40">
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
