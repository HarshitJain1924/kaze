"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SearchIcon } from "@/components/icons";
import { useLibrary } from "@/features/library/library-provider";
import { useScreenLibraryItems } from "@/features/screen/use-screen-library";
import { getDisplayTitle } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/desktop-sidebar";

import { COMMAND_PALETTE_EVENT } from "@/lib/events";

interface Command {
  id: string;
  label: string;
  hint: string;
  href: string;
}

const MAX_RESULTS = 8;

export function CommandPalette() {
  const router = useRouter();
  const { items } = useLibrary();
  const screenItems = useScreenLibraryItems();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ query: "", index: 0 });

  const commands = useMemo<Command[]>(() => {
    const pages = NAV_ITEMS.map((item) => ({
      id: `page-${item.href}`,
      label: item.label,
      hint: "Page",
      href: item.href,
    }));

    const anime = items
      .filter((item) => item.anime !== null)
      .map((item) => ({
        id: `anime-${item.entry.id}`,
        label: item.anime
          ? getDisplayTitle(item.anime.title, true)
          : "Untitled",
        hint: item.entry.mediaType === "manga" ? "Manga" : "Anime",
        href: `/media/${item.entry.anilistId}`,
      }));

    const screen = screenItems.map((item) => ({
      id: `screen-${item.entry.id}`,
      label: item.entry.title,
      hint: item.entry.mediaType === "tv" ? "TV" : "Film",
      href: `/screen/${item.entry.mediaType}/${item.entry.tmdbId}`,
    }));

    return [...pages, ...anime, ...screen];
  }, [items, screenItems]);

  const query = state.query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return commands.slice(0, MAX_RESULTS);
    return commands
      .filter((command) => command.label.toLowerCase().includes(query))
      .slice(0, MAX_RESULTS);
  }, [commands, query]);

  const activeIndex = Math.min(state.index, Math.max(0, filtered.length - 1));

  const close = useCallback(() => {
    setOpen(false);
    setState({ query: "", index: 0 });
  }, []);

  const run = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      close();
      router.push(command.href);
    },
    [close, router],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        setState({ query: "", index: 0 });
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onRequest = () => {
      setOpen(true);
      setState({ query: "", index: 0 });
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(COMMAND_PALETTE_EVENT, onRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onRequest);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[12vh] sm:p-6 sm:pt-[15vh]"
    >
      <button
        type="button"
        aria-label="Close command palette"
        onClick={close}
        className="fixed inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />

      <div className="relative z-10 w-full max-w-lg border border-border bg-bg shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-faint" />
          <input
            autoFocus
            value={state.query}
            onChange={(event) =>
              setState({ query: event.target.value, index: 0 })
            }
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setState((current) => ({
                  ...current,
                  index: Math.min(filtered.length - 1, current.index + 1),
                }));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setState((current) => ({
                  ...current,
                  index: Math.max(0, current.index - 1),
                }));
              } else if (event.key === "Enter") {
                event.preventDefault();
                run(filtered[activeIndex]);
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={
              filtered[activeIndex] ? `command-${filtered[activeIndex].id}` : undefined
            }
            placeholder="Jump to a page or a title…"
            className="h-12 w-full bg-transparent text-sm text-fg placeholder:text-faint focus:outline-none"
          />
          <kbd className="shrink-0 border border-border bg-surface px-1.5 py-0.5 font-mono text-[9px] text-faint">
            esc
          </kbd>
        </div>

        <ul
          id="command-results"
          role="listbox"
          aria-label="Results"
          className="max-h-[52vh] overflow-y-auto py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted">
              Nothing matches “{state.query.trim()}”.
            </li>
          ) : (
            filtered.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  id={`command-${command.id}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() =>
                    setState((current) => ({ ...current, index }))
                  }
                  onClick={() => run(command)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors ${
                    index === activeIndex
                      ? "bg-surface-2 text-fg"
                      : "text-muted hover:bg-surface/60 hover:text-fg"
                  }`}
                >
                  <span className="truncate">{command.label}</span>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
                    {command.hint}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-border px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
          <span>↑ ↓ navigate · ↵ open</span>
          <span>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}
