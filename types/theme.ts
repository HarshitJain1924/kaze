export interface AnimeTheme {
  id: string;
  slug: string; // e.g. "OP1", "ED1"
  type: "OP" | "ED";
  title: string;
  artist: string;
  episodes: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
}

