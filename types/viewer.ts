export interface Viewer {
  id: string;
  email: string | null;
  nickname?: string | null;
  /** Account-level opt-in for 18+ catalogue titles. Defaults to false. */
  showAdult?: boolean;
  createdAt: string | null;
}
