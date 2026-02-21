import { useNavigate } from 'react-router-dom'
import ScrollableRow from '../common/ScrollableRow'

function CastRow({ cast }) {
  const navigate = useNavigate()

  if (!cast || cast.length === 0) {
    return null
  }

  return (
    <div>
      <h2 className="text-2xl font-heading mb-4">Cast</h2>
      <ScrollableRow>
        <div className="flex gap-4 pb-4">
          {cast.map((person) => (
            <div
              key={person.id}
              className="flex-shrink-0 w-32 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate(`/person/${person.id}`)}
            >
              <img
                src={
                  person.profile_path
                    ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
                    : '/placeholder-person.png'
                }
                alt={person.name}
                className="w-full h-48 object-cover rounded-lg mb-2"
              />
              <h3 className="text-sm font-medium truncate">{person.name}</h3>
              <p className="text-xs text-gray-400 truncate">{person.character}</p>
            </div>
          ))}
        </div>
      </ScrollableRow>
    </div>
  )
}

export default CastRow
