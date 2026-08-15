import type { components } from '@/api/types'

type UserDTO = components['schemas']['UserDTO']

// Lista di amici selezionabili via checkbox, usata nei dialog di creazione
// gruppo e aggiunta membri.
export default function FriendPicker({
  friends,
  selectedIds,
  onToggle,
  emptyText = 'Nessun amico disponibile.',
}: {
  friends: UserDTO[]
  selectedIds: number[]
  onToggle: (userId: number) => void
  emptyText?: string
}) {
  if (friends.length === 0) {
    return <p className="text-muted-foreground py-4 text-center text-sm">{emptyText}</p>
  }
  return (
    <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
      {friends.map((friend) =>
        friend.userId == null ? null : (
          <li key={friend.userId}>
            <label className="hover:bg-muted flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3">
              <input
                type="checkbox"
                className="size-4"
                checked={selectedIds.includes(friend.userId)}
                onChange={() => onToggle(friend.userId!)}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{friend.username}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {friend.email}
                </span>
              </span>
            </label>
          </li>
        ),
      )}
    </ul>
  )
}
