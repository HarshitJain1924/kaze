"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  customListItemKey,
  type CustomList,
  type CustomListItem,
  type ListProgress,
} from "@/types/custom-list";
import type { LibraryItem } from "@/types/library";
import type { TmdbLibraryItem } from "@/types/tmdb";

const STORAGE_KEY = "kaze_custom_lists_v2";
const LEGACY_STORAGE_KEY = "kaze_custom_lists_v1";

const DEFAULT_STARTER_LISTS: CustomList[] = [
  {
    id: "peak-fiction-overpowered-mc",
    title: "Peak Fiction: Overpowered MC & Solo Leveling",
    description:
      "The undisputed royalty of overpowering aura, instant level-ups, and jaw-dropping boss decimations. No training wheels attached.",
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: "item_1",
        anilistId: 151807,
        title: "Solo Leveling",
        mediaType: "anime",
        coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png",
        format: "TV",
        averageScore: 84,
        rank: 1,
        notes: "The king of modern power progression. Jinwoo's shadow army awakens with unmatched swagger.",
        addedAt: new Date().toISOString(),
      },
      {
        id: "item_2",
        anilistId: 130298,
        title: "The Eminence in Shadow",
        mediaType: "anime",
        coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130298-YMdcKHytpWNH.jpg",
        format: "TV",
        averageScore: 82,
        rank: 2,
        notes: "I am Atomic. Flawless blend of chuunibyou comedy and genuinely terrifying combat.",
        addedAt: new Date().toISOString(),
      },
      {
        id: "item_3",
        anilistId: 113415,
        title: "JUJUTSU KAISEN",
        mediaType: "anime",
        coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg",
        format: "TV",
        averageScore: 86,
        rank: 3,
        notes: "Gojo Satoru redefined what it means to be the honored one. Mappa went feral.",
        addedAt: new Date().toISOString(),
      },
      {
        id: "item_4",
        anilistId: 21507,
        title: "Mob Psycho 100",
        mediaType: "anime",
        coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21507-6YUSbh2m0N1p.jpg",
        format: "TV",
        averageScore: 85,
        rank: 4,
        notes: "Unlimited psychic potential paired with peak emotional maturity by ONE and Studio Bones.",
        addedAt: new Date().toISOString(),
      },
      {
        id: "item_5",
        anilistId: 21087,
        title: "One Punch Man",
        mediaType: "anime",
        coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21087-B5DHjqZ3kW4b.jpg",
        format: "TV",
        averageScore: 84,
        rank: 5,
        notes: "Serious Punch. Madhouse's masterclass in kinetic animation that set the modern standard.",
        addedAt: new Date().toISOString(),
      },
    ],
  },
  {
    id: "late-night-3am-anime",
    title: "Late Night 3 AM Anime: Dark & Atmospheric",
    description:
      "Eerie soundtracks, psychological dread, rain-soaked cityscapes, and moral ambiguities meant to be experienced in pitch darkness.",
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: "item_6",
        anilistId: 9253,
        title: "Steins;Gate",
        mediaType: "anime",
        coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-tIUXF2gfU8Sg.jpg",
        format: "TV",
        averageScore: 89,
        rank: 1,
        notes: "El Psy Kongroo. The absolute pinnacle of time travel suspense, paranoia, and heartbreak.",
        addedAt: new Date().toISOString(),
      },
      {
        id: "item_7",
        anilistId: 120377,
        title: "Cyberpunk: Edgerunners",
        mediaType: "anime",
        coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx120377-ayZPoxiWt4Li.jpg",
        format: "ONA",
        averageScore: 86,
        rank: 2,
        notes: "Night City will chew you up and spit you out. Trigger at their most unhinged and poignant.",
        addedAt: new Date().toISOString(),
      },
      {
        id: "item_8",
        anilistId: 19,
        title: "Monster",
        mediaType: "anime",
        coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx19-gtMC64182sm4.jpg",
        format: "TV",
        averageScore: 88,
        rank: 3,
        notes: "Johan Liebert remains the most chilling, philosophical antagonist in all of fiction.",
        addedAt: new Date().toISOString(),
      },
      {
        id: "item_9",
        anilistId: 1535,
        title: "Death Note",
        mediaType: "anime",
        coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-kUgkcrfOrkUM.jpg",
        format: "TV",
        averageScore: 84,
        rank: 4,
        notes: "The ultimate psychological duel of intellects, cat-and-mouse gambits, and potato chips.",
        addedAt: new Date().toISOString(),
      },
    ],
  },
];

function healLists(lists: CustomList[]): CustomList[] {
  const starterMap = new Map<string, CustomList>(
    DEFAULT_STARTER_LISTS.map((sl) => [sl.id, sl]),
  );

  return lists.map((list) => {
    const starter = starterMap.get(list.id);
    if (!starter) return list;

    // For default starter lists, replace/repair items whose covers match known starter items
    const updatedItems = list.items.map((item) => {
      const defaultItem = starter.items.find(
        (di) =>
          (item.anilistId !== undefined && di.anilistId === item.anilistId) ||
          di.id === item.id ||
          di.title.toLowerCase() === item.title.toLowerCase(),
      );
      if (defaultItem) {
        return {
          ...item,
          anilistId: defaultItem.anilistId,
          coverImage: defaultItem.coverImage,
        };
      }
      return item;
    });

    return {
      ...list,
      items: updatedItems,
    };
  });
}

interface CustomListsContextValue {
  lists: CustomList[];
  isLoaded: boolean;
  createList: (title: string, description: string, isPublic?: boolean) => CustomList;
  deleteList: (id: string) => void;
  addItemToList: (listId: string, item: Omit<CustomListItem, "id" | "addedAt">) => void;
  removeItemFromList: (listId: string, itemKey: string) => void;
  updateItemNotes: (listId: string, itemKey: string, notes: string) => void;
  getList: (id: string) => CustomList | undefined;
  isItemInList: (listId: string, itemKey: string) => boolean;
  calculateProgress: (
    list: CustomList,
    libraryItems: LibraryItem[],
    screenItems?: TmdbLibraryItem[],
  ) => ListProgress;
}

const CustomListsContext = createContext<CustomListsContextValue | null>(null);

/**
 * A curated entry counts as watched when its matching library row says so:
 * anime needs progress or a completed status, a film needs its watched flag,
 * and a series needs at least one recorded episode.
 */
export function computeListProgress(
  list: CustomList,
  libraryItems: LibraryItem[],
  screenItems: TmdbLibraryItem[] = [],
): ListProgress {
  const totalCount = list.items.length;
  if (totalCount === 0) {
    return { watchedCount: 0, totalCount: 0, percentage: 0, isFullyWatched: false };
  }

  const watchedAnime = new Set(
    libraryItems
      .filter(
        (item) => item.entry.status === "completed" || item.entry.progress > 0,
      )
      .map((item) => item.entry.anilistId),
  );

  const watchedScreen = new Set(
    screenItems
      .filter(
        (item) =>
          item.entry.watched ||
          item.entry.status === "completed" ||
          item.watchedCount > 0,
      )
      .map((item) => `tmdb:${item.entry.mediaType}:${item.entry.tmdbId}`),
  );

  let watchedCount = 0;
  for (const item of list.items) {
    const itemKey = customListItemKey(item);
    const isWatched = itemKey.startsWith("tmdb:")
      ? watchedScreen.has(itemKey)
      : watchedAnime.has(item.anilistId ?? -1);
    if (isWatched) watchedCount += 1;
  }

  const percentage = Math.round((watchedCount / totalCount) * 100);
  return {
    watchedCount,
    totalCount,
    percentage,
    isFullyWatched: watchedCount === totalCount,
  };
}

export function useProgressCalculation(
  list: CustomList,
  libraryItems: LibraryItem[],
  screenItems: TmdbLibraryItem[] = [],
): ListProgress {
  return computeListProgress(list, libraryItems, screenItems);
}

export function CustomListsProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<CustomList[]>(() => {
    if (typeof window === "undefined") return DEFAULT_STARTER_LISTS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return healLists(parsed);
        }
      }

      // Check legacy storage key and migrate
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          const healed = healLists(parsedLegacy);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(healed));
            localStorage.removeItem(LEGACY_STORAGE_KEY);
          } catch {
            // Ignore quota or private browsing errors
          }
          return healed;
        }
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STARTER_LISTS));
    } catch (e) {
      console.warn("[CustomLists] localStorage load failed; using defaults", e);
    }
    return DEFAULT_STARTER_LISTS;
  });
  const [isLoaded] = useState(true);

  // Sync to localStorage whenever lists change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch (e) {
      console.error("[CustomLists] save failed", e);
    }
  }, [lists]);

  // Save changes
  const saveLists = useCallback((updated: CustomList[]) => {
    setLists(updated);
  }, []);

  const createList = useCallback(
    (title: string, description: string, isPublic = true): CustomList => {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const uniqueId = `${slug || "list"}-${Date.now().toString(36)}`;

      const newList: CustomList = {
        id: uniqueId,
        title: title.trim(),
        description: description.trim(),
        isPublic,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      };

      saveLists([newList, ...lists]);
      return newList;
    },
    [lists, saveLists],
  );

  const deleteList = useCallback(
    (id: string) => {
      saveLists(lists.filter((l) => l.id !== id));
    },
    [lists, saveLists],
  );

  const addItemToList = useCallback(
    (listId: string, itemData: Omit<CustomListItem, "id" | "addedAt">) => {
      saveLists(
        lists.map((list) => {
          if (list.id !== listId) return list;
          // Don't add duplicate
          const itemKey = customListItemKey(itemData);
          if (list.items.some((it) => customListItemKey(it) === itemKey)) {
            return list;
          }

          const newItem: CustomListItem = {
            ...itemData,
            id: `item_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            rank: itemData.rank ?? list.items.length + 1,
            addedAt: new Date().toISOString(),
          };

          return {
            ...list,
            updatedAt: new Date().toISOString(),
            items: [...list.items, newItem],
          };
        }),
      );
    },
    [lists, saveLists],
  );

  const removeItemFromList = useCallback(
    (listId: string, itemKey: string) => {
      saveLists(
        lists.map((list) => {
          if (list.id !== listId) return list;
          return {
            ...list,
            updatedAt: new Date().toISOString(),
            items: list.items.filter(
              (it) => customListItemKey(it) !== itemKey,
            ),
          };
        }),
      );
    },
    [lists, saveLists],
  );

  const updateItemNotes = useCallback(
    (listId: string, itemKey: string, notes: string) => {
      saveLists(
        lists.map((list) => {
          if (list.id !== listId) return list;
          return {
            ...list,
            updatedAt: new Date().toISOString(),
            items: list.items.map((it) =>
              customListItemKey(it) === itemKey
                ? { ...it, notes: notes.trim() }
                : it,
            ),
          };
        }),
      );
    },
    [lists, saveLists],
  );

  const getList = useCallback(
    (id: string) => {
      return lists.find((l) => l.id === id);
    },
    [lists],
  );

  const isItemInList = useCallback(
    (listId: string, itemKey: string) => {
      const list = lists.find((l) => l.id === listId);
      return Boolean(
        list?.items.some((it) => customListItemKey(it) === itemKey),
      );
    },
    [lists],
  );

  const calculateProgress = useCallback(
    (
      list: CustomList,
      libraryItems: LibraryItem[],
      screenItems: TmdbLibraryItem[] = [],
    ): ListProgress => computeListProgress(list, libraryItems, screenItems),
    [],
  );

  return (
    <CustomListsContext.Provider
      value={{
        lists,
        isLoaded,
        createList,
        deleteList,
        addItemToList,
        removeItemFromList,
        updateItemNotes,
        getList,
        isItemInList,
        calculateProgress,
      }}
    >
      {children}
    </CustomListsContext.Provider>
  );
}

export function useCustomLists() {
  const ctx = useContext(CustomListsContext);
  if (!ctx) {
    throw new Error("useCustomLists must be used within a CustomListsProvider");
  }
  return ctx;
}
