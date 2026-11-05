import type { MediaType } from "@/types/anime";
import type { WatchStatus } from "@/types/library";

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

/**
 * Supabase Database definition.
 *
 * NOTE: Manually synchronized from PostgreSQL migrations:
 * - 20261021000000_create_catalog_cache.sql
 * - 20261105000000_create_canonical_media_schema.sql
 * - 20261105000001_backfill_canonical_library.sql
 * (Supabase CLI was not running locally to auto-generate from live server).
 */
export interface Database {
  public: {
    Tables: {
      /**
       * Shared, provider-owned catalogue metadata cache.
       *
       * Deliberately separate from user_anime / user_anime_episodes: it holds
       * only public AniList/Kitsu metadata and must never store a user id,
       * progress, rating or notes. Row level security is enabled with no
       * policies for anon/authenticated, so only the server service role reads
       * or writes it.
       */
      catalog_cache: {
        Row: {
          key: string;
          payload: Json;
          cached_at: string;
          fresh_until: string;
          expires_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          payload: Json;
          cached_at?: string;
          fresh_until: string;
          expires_at: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          payload?: Json;
          cached_at?: string;
          fresh_until?: string;
          expires_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_anime: {
        Row: {
          id: string;
          user_id: string;
          anilist_id: number;
          media_type: MediaType;
          status: WatchStatus;
          progress: number;
          volumes_progress: number;
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
          media_type?: MediaType;
          status?: WatchStatus;
          progress?: number;
          volumes_progress?: number;
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
          media_type?: MediaType;
          status?: WatchStatus;
          progress?: number;
          volumes_progress?: number;
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
      media: {
        Row: {
          id: string;
          kind: "anime" | "manga" | "movie" | "tv";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: "anime" | "manga" | "movie" | "tv";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: "anime" | "manga" | "movie" | "tv";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_external_ids: {
        Row: {
          id: string;
          media_id: string;
          provider: "anilist" | "kitsu" | "tmdb" | "mal" | "mangadex";
          external_id: string;
          source_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          media_id: string;
          provider: "anilist" | "kitsu" | "tmdb" | "mal" | "mangadex";
          external_id: string;
          source_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          media_id?: string;
          provider?: "anilist" | "kitsu" | "tmdb" | "mal" | "mangadex";
          external_id?: string;
          source_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_external_ids_media_fk";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      media_titles: {
        Row: {
          id: string;
          media_id: string;
          language: string | null;
          title: string;
          title_type: "primary" | "romaji" | "english" | "native" | "alternate";
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          media_id: string;
          language?: string | null;
          title: string;
          title_type: "primary" | "romaji" | "english" | "native" | "alternate";
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          media_id?: string;
          language?: string | null;
          title?: string;
          title_type?: "primary" | "romaji" | "english" | "native" | "alternate";
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_titles_media_fk";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      media_artwork: {
        Row: {
          id: string;
          media_id: string;
          provider: "anilist" | "kitsu" | "tmdb" | "mal" | "mangadex";
          role: "poster" | "backdrop" | "banner" | "logo";
          url: string;
          width: number | null;
          height: number | null;
          aspect_ratio: number | null;
          focal_x: number | null;
          focal_y: number | null;
          language: string | null;
          attribution: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          media_id: string;
          provider: "anilist" | "kitsu" | "tmdb" | "mal" | "mangadex";
          role: "poster" | "backdrop" | "banner" | "logo";
          url: string;
          width?: number | null;
          height?: number | null;
          aspect_ratio?: number | null;
          focal_x?: number | null;
          focal_y?: number | null;
          language?: string | null;
          attribution?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          media_id?: string;
          provider?: "anilist" | "kitsu" | "tmdb" | "mal" | "mangadex";
          role?: "poster" | "backdrop" | "banner" | "logo";
          url?: string;
          width?: number | null;
          height?: number | null;
          aspect_ratio?: number | null;
          focal_x?: number | null;
          focal_y?: number | null;
          language?: string | null;
          attribution?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_artwork_media_fk";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      media_anime_details: {
        Row: {
          media_id: string;
          kind: "anime";
          episodes: number | null;
          duration_minutes: number | null;
          country_of_origin: string | null;
          season: string | null;
          studios: string[];
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          media_id: string;
          kind?: "anime";
          episodes?: number | null;
          duration_minutes?: number | null;
          country_of_origin?: string | null;
          season?: string | null;
          studios?: string[];
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          media_id?: string;
          kind?: "anime";
          episodes?: number | null;
          duration_minutes?: number | null;
          country_of_origin?: string | null;
          season?: string | null;
          studios?: string[];
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_anime_details_media_kind_fk";
            columns: ["media_id", "kind"];
            isOneToOne: true;
            referencedRelation: "media";
            referencedColumns: ["id", "kind"];
          },
        ];
      };
      media_manga_details: {
        Row: {
          media_id: string;
          kind: "manga";
          chapters: number | null;
          volumes: number | null;
          country_of_origin: string | null;
          authors: string[];
          artists: string[];
          publication_status: string | null;
          reading_format: string | null;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          media_id: string;
          kind?: "manga";
          chapters?: number | null;
          volumes?: number | null;
          country_of_origin?: string | null;
          authors?: string[];
          artists?: string[];
          publication_status?: string | null;
          reading_format?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          media_id?: string;
          kind?: "manga";
          chapters?: number | null;
          volumes?: number | null;
          country_of_origin?: string | null;
          authors?: string[];
          artists?: string[];
          publication_status?: string | null;
          reading_format?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_manga_details_media_kind_fk";
            columns: ["media_id", "kind"];
            isOneToOne: true;
            referencedRelation: "media";
            referencedColumns: ["id", "kind"];
          },
        ];
      };
      media_movie_details: {
        Row: {
          media_id: string;
          kind: "movie";
          runtime_minutes: number | null;
          release_date: string | null;
          production_companies: string[];
          cast_members: Json;
          crew_members: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          media_id: string;
          kind?: "movie";
          runtime_minutes?: number | null;
          release_date?: string | null;
          production_companies?: string[];
          cast_members?: Json;
          crew_members?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          media_id?: string;
          kind?: "movie";
          runtime_minutes?: number | null;
          release_date?: string | null;
          production_companies?: string[];
          cast_members?: Json;
          crew_members?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_movie_details_media_kind_fk";
            columns: ["media_id", "kind"];
            isOneToOne: true;
            referencedRelation: "media";
            referencedColumns: ["id", "kind"];
          },
        ];
      };
      media_tv_details: {
        Row: {
          media_id: string;
          kind: "tv";
          season_count: number | null;
          episode_count: number | null;
          episode_runtime_minutes: number | null;
          networks: string[];
          next_episode: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          media_id: string;
          kind?: "tv";
          season_count?: number | null;
          episode_count?: number | null;
          episode_runtime_minutes?: number | null;
          networks?: string[];
          next_episode?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          media_id?: string;
          kind?: "tv";
          season_count?: number | null;
          episode_count?: number | null;
          episode_runtime_minutes?: number | null;
          networks?: string[];
          next_episode?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "media_tv_details_media_kind_fk";
            columns: ["media_id", "kind"];
            isOneToOne: true;
            referencedRelation: "media";
            referencedColumns: ["id", "kind"];
          },
        ];
      };
      user_media: {
        Row: {
          id: string;
          user_id: string;
          media_id: string;
          media_kind: "anime" | "manga" | "movie" | "tv";
          status: WatchStatus;
          episodes_watched: number | null;
          chapters_read: number | null;
          volumes_read: number | null;
          movie_watched: boolean | null;
          tv_season_number: number | null;
          tv_episode_number: number | null;
          tv_episodes_watched: number | null;
          score: number | null;
          favorite: boolean;
          notes: string | null;
          rewatch_count: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_id: string;
          media_kind: "anime" | "manga" | "movie" | "tv";
          status?: WatchStatus;
          episodes_watched?: number | null;
          chapters_read?: number | null;
          volumes_read?: number | null;
          movie_watched?: boolean | null;
          tv_season_number?: number | null;
          tv_episode_number?: number | null;
          tv_episodes_watched?: number | null;
          score?: number | null;
          favorite?: boolean;
          notes?: string | null;
          rewatch_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_id?: string;
          media_kind?: "anime" | "manga" | "movie" | "tv";
          status?: WatchStatus;
          episodes_watched?: number | null;
          chapters_read?: number | null;
          volumes_read?: number | null;
          movie_watched?: boolean | null;
          tv_season_number?: number | null;
          tv_episode_number?: number | null;
          tv_episodes_watched?: number | null;
          score?: number | null;
          favorite?: boolean;
          notes?: string | null;
          rewatch_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_media_media_kind_fk";
            columns: ["media_id", "media_kind"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id", "kind"];
          },
        ];
      };
      user_media_episodes: {
        Row: {
          id: string;
          user_id: string;
          user_media_id: string;
          media_kind: "anime" | "tv";
          season_number: number;
          episode_number: number;
          watched_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_media_id: string;
          media_kind?: "anime" | "tv";
          season_number?: number;
          episode_number: number;
          watched_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          user_media_id?: string;
          media_kind?: "anime" | "tv";
          season_number?: number;
          episode_number?: number;
          watched_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_media_episodes_owner_kind_fk";
            columns: ["user_media_id", "user_id", "media_kind"];
            isOneToOne: false;
            referencedRelation: "user_media";
            referencedColumns: ["id", "user_id", "media_kind"];
          },
        ];
      };
      media_backfill_issues: {
        Row: {
          id: string;
          run_id: string;
          legacy_table: string;
          legacy_id: string;
          reason: string;
          details: Json;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          legacy_table: string;
          legacy_id: string;
          reason: string;
          details?: Json;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          legacy_table?: string;
          legacy_id?: string;
          reason?: string;
          details?: Json;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      deterministic_anilist_media_id: {
        Args: {
          p_anilist_id: number;
        };
        Returns: string;
      };
      backfill_phase2b: {
        Args: {
          p_run_id?: string;
        };
        Returns: Json;
      };
      validate_phase2b: {
        Args: Record<string, never>;
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
