"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/providers/toast-provider";
import { usePreferences } from "@/components/providers/preferences-provider";
import { ApiRequestError, apiFetch } from "@/lib/http";
import {
  applyLibraryEntryUpdate,
  LibraryProgressError,
} from "@/lib/library-rules";
import { WATCH_STATUS_META, WATCH_STATUS_ORDER } from "@/lib/library-meta";
import { getDisplayTitle, todayIsoDate } from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";
import type {
  LibraryEntry,
  LibraryItem,
  WatchStatus,
} from "@/types/library";

export interface LibraryMutationPatch {
  status?: WatchStatus;
  progress?: number;
  score?: number | null;
  notes?: string | null;
}

interface AddResponse {
  entry: LibraryEntry;
  created: boolean;
}

interface UpdateResponse {
  entry: LibraryEntry;
}

export interface LibraryContextValue {
  items: LibraryItem[];
  canWrite: boolean;
  /** True when the server could not read the library at all. */
  loadError: boolean;
  pendingIds: ReadonlySet<number>;
  entryFor: (anilistId: number) => LibraryEntry | null;
  animeFor: (anilistId: number) => AnimeSummary | null;
  addToLibrary: (
    anime: AnimeSummary,
    status?: WatchStatus,
  ) => Promise<boolean>;
  updateEntry: (
    anilistId: number,
    patch: LibraryMutationPatch,
  ) => Promise<boolean>;
  incrementProgress: (anilistId: number) => Promise<boolean>;
  removeEntry: (anilistId: number) => Promise<boolean>;
  requestAdd: (anime: AnimeSummary) => void;
  requestRemove: (anilistId: number) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function messageFor(error: unknown): string {
  if (
    error instanceof LibraryProgressError ||
    error instanceof ApiRequestError
  ) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export function LibraryProvider({
  children,
  initialItems,
  canWrite,
  loadError = false,
}: {
  children: ReactNode;
  initialItems: LibraryItem[];
  canWrite: boolean;
  loadError?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { preferences } = usePreferences();

  const [items, setItems] = useState<LibraryItem[]>(initialItems);
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const [addTarget, setAddTarget] = useState<AnimeSummary | null>(null);
  const [addStatus, setAddStatus] = useState<WatchStatus>("planning");
  const [removeTargetId, setRemoveTargetId] = useState<number | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  // Returning to the tab refreshes server data so changes from another device
  // are picked up. The layout remounts this provider when the refreshed
  // snapshot differs, which keeps optimistic state intact otherwise.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [router]);

  const entryMap = useMemo(
    () => new Map(items.map((item) => [item.entry.anilistId, item.entry])),
    [items],
  );

  const animeMap = useMemo(() => {
    const map = new Map<number, AnimeSummary>();
    for (const item of items) {
      if (item.anime) {
        map.set(item.entry.anilistId, item.anime);
      }
    }
    return map;
  }, [items]);

  const entryFor = useCallback(
    (anilistId: number) => entryMap.get(anilistId) ?? null,
    [entryMap],
  );

  const animeFor = useCallback(
    (anilistId: number) => animeMap.get(anilistId) ?? null,
    [animeMap],
  );

  const requireSignIn = useCallback(() => {
    toast({
      title: "Sign in to build your library",
      description: "Your watchlist stays in sync across your devices.",
    });
    const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
    router.push(`/login${next}`);
  }, [pathname, router, toast]);

  const setEntryPending = useCallback((anilistId: number, value: boolean) => {
    setPending((current) => {
      const next = new Set(current);
      if (value) {
        next.add(anilistId);
      } else {
        next.delete(anilistId);
      }
      return next;
    });
  }, []);

  const addToLibrary = useCallback(
    async (anime: AnimeSummary, status: WatchStatus = "planning") => {
      if (!canWrite) {
        requireSignIn();
        return false;
      }
      if (entryMap.has(anime.id)) {
        toast({ title: "This anime is already in your library" });
        return false;
      }

      const optimisticId = `optimistic-${anime.id}`;
      const now = new Date().toISOString();
      const today = todayIsoDate();
      const optimistic: LibraryEntry = {
        id: optimisticId,
        userId: "",
        anilistId: anime.id,
        status,
        progress: 0,
        score: null,
        startedAt:
          status === "watching" || status === "completed" ? today : null,
        completedAt: status === "completed" ? today : null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      };

      setEntryPending(anime.id, true);
      setItems((current) => [...current, { entry: optimistic, anime }]);

      try {
        const data = await apiFetch<AddResponse>("/api/library", {
          method: "POST",
          body: JSON.stringify({ anilistId: anime.id, status }),
        });
        setItems((current) =>
          current.map((item) =>
            item.entry.anilistId === anime.id
              ? { entry: data.entry, anime }
              : item,
          ),
        );
        toast({
          title: data.created
            ? "Added to your library"
            : "Already in your library",
          description: getDisplayTitle(anime.title),
          tone: "success",
        });
        return true;
      } catch (error) {
        setItems((current) =>
          current.filter((item) => item.entry.id !== optimisticId),
        );
        toast({
          title: "Could not add this anime",
          description: messageFor(error),
          tone: "error",
        });
        return false;
      } finally {
        setEntryPending(anime.id, false);
      }
    },
    [
      canWrite,
      entryMap,
      requireSignIn,
      setEntryPending,
      toast,
    ],
  );

  const updateEntry = useCallback(
    async (anilistId: number, patch: LibraryMutationPatch) => {
      if (!canWrite) {
        requireSignIn();
        return false;
      }

      const previous = entryMap.get(anilistId);
      if (!previous) {
        toast({ title: "This anime is not in your library yet", tone: "error" });
        return false;
      }
      if (pending.has(anilistId)) {
        return false;
      }

      const episodes = animeMap.get(anilistId)?.episodes ?? null;

      let optimisticEntry: LibraryEntry;
      try {
        const applied = applyLibraryEntryUpdate(previous, patch, episodes);
        optimisticEntry = {
          ...previous,
          ...applied,
          updatedAt: new Date().toISOString(),
        };
      } catch (error) {
        toast({
          title: "Could not update this entry",
          description: messageFor(error),
          tone: "error",
        });
        return false;
      }

      setEntryPending(anilistId, true);
      setItems((current) =>
        current.map((item) =>
          item.entry.anilistId === anilistId
            ? { ...item, entry: optimisticEntry }
            : item,
        ),
      );

      try {
        const data = await apiFetch<UpdateResponse>(
          `/api/library/${anilistId}`,
          {
            method: "PATCH",
            body: JSON.stringify(patch),
          },
        );
        setItems((current) =>
          current.map((item) =>
            item.entry.anilistId === anilistId
              ? { ...item, entry: data.entry }
              : item,
          ),
        );
        return true;
      } catch (error) {
        setItems((current) =>
          current.map((item) =>
            item.entry.anilistId === anilistId
              ? { ...item, entry: previous }
              : item,
          ),
        );
        toast({
          title: "Could not save your change",
          description: messageFor(error),
          tone: "error",
        });
        return false;
      } finally {
        setEntryPending(anilistId, false);
      }
    },
    [
      animeMap,
      canWrite,
      entryMap,
      pending,
      requireSignIn,
      setEntryPending,
      toast,
    ],
  );

  const incrementProgress = useCallback(
    async (anilistId: number) => {
      const entry = entryMap.get(anilistId);
      if (!entry) {
        return false;
      }
      const episodes = animeMap.get(anilistId)?.episodes ?? null;
      if (episodes !== null && entry.progress >= episodes) {
        toast({
          title: "You are at the final episode",
          description:
            episodes === 0
              ? "This title has no reported episodes yet."
              : `All ${episodes} episodes are marked as watched.`,
        });
        return false;
      }
      return updateEntry(anilistId, { progress: entry.progress + 1 });
    },
    [animeMap, entryMap, toast, updateEntry],
  );

  const removeEntry = useCallback(
    async (anilistId: number) => {
      if (!canWrite) {
        requireSignIn();
        return false;
      }
      const previous = items;
      setEntryPending(anilistId, true);
      setItems((current) =>
        current.filter((item) => item.entry.anilistId !== anilistId),
      );

      try {
        await apiFetch<{ removed: boolean }>(`/api/library/${anilistId}`, {
          method: "DELETE",
        });
        toast({ title: "Removed from your library", tone: "success" });
        return true;
      } catch (error) {
        setItems(previous);
        toast({
          title: "Could not remove this anime",
          description: messageFor(error),
          tone: "error",
        });
        return false;
      } finally {
        setEntryPending(anilistId, false);
      }
    },
    [canWrite, items, requireSignIn, setEntryPending, toast],
  );

  const requestAdd = useCallback(
    (anime: AnimeSummary) => {
      if (!canWrite) {
        requireSignIn();
        return;
      }
      setAddStatus("planning");
      setAddTarget(anime);
    },
    [canWrite, requireSignIn],
  );

  const requestRemove = useCallback(
    (anilistId: number) => {
      if (!canWrite) {
        requireSignIn();
        return;
      }
      setRemoveTargetId(anilistId);
    },
    [canWrite, requireSignIn],
  );

  const removeAnime = removeTargetId
    ? animeFor(removeTargetId)
    : null;
  const removeEntryData = removeTargetId
    ? entryFor(removeTargetId)
    : null;

  const handleAdd = async () => {
    if (!addTarget) {
      return;
    }
    setDialogBusy(true);
    const success = await addToLibrary(addTarget, addStatus);
    setDialogBusy(false);
    if (success) {
      setAddTarget(null);
    }
  };

  const handleRemove = async () => {
    if (!removeTargetId) {
      return;
    }
    setDialogBusy(true);
    const success = await removeEntry(removeTargetId);
    setDialogBusy(false);
    if (success) {
      setRemoveTargetId(null);
    }
  };

  const value = useMemo<LibraryContextValue>(
    () => ({
      items,
      canWrite,
      loadError,
      pendingIds: pending,
      entryFor,
      animeFor,
      addToLibrary,
      updateEntry,
      incrementProgress,
      removeEntry,
      requestAdd,
      requestRemove,
    }),
    [
      addToLibrary,
      animeFor,
      canWrite,
      entryFor,
      incrementProgress,
      items,
      loadError,
      pending,
      removeEntry,
      requestAdd,
      requestRemove,
      updateEntry,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}

      <Dialog
        open={addTarget !== null}
        onClose={() => {
          if (!dialogBusy) {
            setAddTarget(null);
          }
        }}
        title="Add to library"
        description={
          addTarget
            ? getDisplayTitle(addTarget.title, preferences.titleLanguage === "english")
            : undefined
        }
        mobileSheet
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setAddTarget(null)}
              disabled={dialogBusy}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAdd} disabled={dialogBusy}>
              {dialogBusy ? "Adding…" : "Add anime"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {addTarget ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>{WATCH_STATUS_META[addStatus].description}</span>
            </div>
          ) : null}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
              Status
            </span>
            <Select
              value={addStatus}
              onChange={(event) =>
                setAddStatus(event.target.value as WatchStatus)
              }
              disabled={dialogBusy}
            >
              {WATCH_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {WATCH_STATUS_META[status].label}
                </option>
              ))}
            </Select>
          </label>
          <p className="text-xs leading-relaxed text-faint">
            Episode progress, ratings and notes can be edited at any time from
            the anime page or your library.
          </p>
        </div>
      </Dialog>

      <ConfirmationDialog
        open={removeTargetId !== null}
        onClose={() => {
          if (!dialogBusy) {
            setRemoveTargetId(null);
          }
        }}
        onConfirm={() => void handleRemove()}
        title="Remove from library?"
        description={
          removeAnime
            ? `“${getDisplayTitle(removeAnime.title, preferences.titleLanguage === "english")}” will be removed from your library.`
            : "This title will be removed from your library."
        }
        confirmLabel="Remove"
        cancelLabel="Keep it"
        destructive
        loading={dialogBusy}
      >
        <p className="text-sm leading-relaxed text-muted">
          Your episode progress
          {removeEntryData?.score !== null &&
          removeEntryData?.score !== undefined
            ? ", rating"
            : ""}{" "}
          and notes for this anime will be deleted. This cannot be undone.
        </p>
      </ConfirmationDialog>
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used inside LibraryProvider");
  }
  return context;
}
