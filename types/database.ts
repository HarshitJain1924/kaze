import type { WatchStatus } from "@/types/library";

export interface Database {
  public: {
    Tables: {
      user_anime: {
        Row: {
          id: string;
          user_id: string;
          anilist_id: number;
          status: WatchStatus;
          progress: number;
          score: number | null;
          started_at: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          anilist_id: number;
          status?: WatchStatus;
          progress?: number;
          score?: number | null;
          started_at?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          anilist_id?: number;
          status?: WatchStatus;
          progress?: number;
          score?: number | null;
          started_at?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_anime_episodes: {
        Row: {
          id: string;
          user_id: string;
          anilist_id: number;
          episode_number: number;
          watched_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          anilist_id: number;
          episode_number: number;
          watched_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          anilist_id?: number;
          episode_number?: number;
          watched_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_anime_episodes_user_anime_fk";
            columns: ["user_id", "anilist_id"];
            isOneToOne: false;
            referencedRelation: "user_anime";
            referencedColumns: ["user_id", "anilist_id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
