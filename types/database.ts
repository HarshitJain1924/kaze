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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
