export type LibraryKind = 'source' | 'result' | 'camera'
export type LibraryMediaType = 'video' | 'audio'

export interface LibraryEntry {
  id: string
  name: string
  kind: LibraryKind
  mediaType: LibraryMediaType
  mime: string
  size: number
  duration: number | null
  createdAt: string
  favorite: boolean
  thumbnail: string | null
  parentId: string | null
}

export interface LibraryState {
  entries: LibraryEntry[]
}
