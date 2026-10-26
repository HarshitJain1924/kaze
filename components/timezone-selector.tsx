"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { CheckIcon, ChevronDownIcon, GlobeIcon, SearchIcon } from "@/components/icons";
import { useActiveTimeZone } from "@/components/providers/preferences-provider";
import {
  COMMON_TIMEZONES,
  getTimeZoneAbbr,
  getTimeZoneDisplayName,
} from "@/lib/schedule";
import { cn } from "@/lib/utils";

interface TimezoneSelectorProps {
  /** "badge" is a compact pill with popover, "select" is a form <select> element. */
  variant?: "badge" | "select";
  className?: string;
  onSelect?: (tz: string) => void;
}

export function TimezoneSelector({
  variant = "badge",
  className,
  onSelect,
}: TimezoneSelectorProps) {
  const {
    activeTimeZone,
    preference,
    isAuto,
    deviceTimeZone,
    mounted,
    setTimeZone,
  } = useActiveTimeZone();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectId = useId();

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
    } else {
      setSearch("");
    }
  }, [open]);

  const activeAbbr = useMemo(() => {
    return getTimeZoneAbbr(undefined, activeTimeZone);
  }, [activeTimeZone]);

  const deviceAbbr = useMemo(() => {
    return getTimeZoneAbbr(undefined, deviceTimeZone);
  }, [deviceTimeZone]);

  const activeDisplay = useMemo(() => {
    if (isAuto) {
      return mounted ? `${deviceAbbr} · Local` : "Local time";
    }
    return activeAbbr;
  }, [isAuto, mounted, deviceAbbr, activeAbbr]);

  const handleChoose = (tzValue: string) => {
    setTimeZone(tzValue);
    onSelect?.(tzValue);
    setOpen(false);
  };

  const isJapanTime = activeTimeZone === "Asia/Tokyo";

  const handleToggleJapanLocal = () => {
    if (isJapanTime) {
      handleChoose("auto");
    } else {
      handleChoose("Asia/Tokyo");
    }
  };

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return COMMON_TIMEZONES;
    const q = search.toLowerCase();
    return COMMON_TIMEZONES.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        opt.region.toLowerCase().includes(q),
    );
  }, [search]);

  if (variant === "select") {
    return (
      <select
        id={selectId}
        value={preference}
        onChange={(e) => handleChoose(e.target.value)}
        className={cn(
          "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-fg shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          className,
        )}
      >
        <option value="auto">
          Device local (Auto-detect: {mounted ? deviceTimeZone : "local"})
        </option>
        <option value="Asia/Tokyo">
          Japan Standard Time (JST) · Original broadcast
        </option>
        <optgroup label="Asia & Pacific">
          <option value="Asia/Kolkata">India Standard Time (IST)</option>
          <option value="Asia/Singapore">Singapore / Malaysia (SGT)</option>
          <option value="Asia/Seoul">Korea Standard Time (KST)</option>
          <option value="Asia/Shanghai">China Standard Time (CST)</option>
          <option value="Asia/Bangkok">Indochina Time (ICT)</option>
          <option value="Asia/Dubai">Gulf Standard Time (GST)</option>
          <option value="Australia/Sydney">Australian Eastern (AEST/AEDT)</option>
        </optgroup>
        <optgroup label="Americas">
          <option value="America/New_York">Eastern Time (ET - New York)</option>
          <option value="America/Chicago">Central Time (CT - Chicago)</option>
          <option value="America/Denver">Mountain Time (MT - Denver)</option>
          <option value="America/Los_Angeles">Pacific Time (PT - Los Angeles)</option>
          <option value="America/Sao_Paulo">Brasília Time (BRT - São Paulo)</option>
        </optgroup>
        <optgroup label="Europe">
          <option value="Europe/London">UK / Ireland (GMT / BST - London)</option>
          <option value="Europe/Paris">Central European Time (CET - Paris, Berlin)</option>
          <option value="Europe/Athens">Eastern European Time (EET - Athens)</option>
        </optgroup>
        <optgroup label="Universal">
          <option value="UTC">Coordinated Universal Time (UTC)</option>
        </optgroup>
      </select>
    );
  }

  return (
    <div className={cn("relative inline-block text-left", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
          open
            ? "border-accent bg-accent/15 text-accent-strong ring-1 ring-accent/40"
            : "border-border-subtle bg-surface-2/80 text-fg hover:border-border hover:bg-surface-3 hover:text-accent-strong",
        )}
        title={`Current timezone: ${getTimeZoneDisplayName(activeTimeZone, deviceTimeZone)}`}
      >
        <GlobeIcon className="h-3.5 w-3.5 text-accent-strong" />
        <span suppressHydrationWarning className="tabular-nums">
          {activeDisplay}
        </span>
        <ChevronDownIcon
          className={cn(
            "h-3 w-3 text-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Select timezone"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 sm:w-80 rounded-2xl border border-border bg-surface p-3 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div>
              <p className="text-xs font-semibold text-fg">Timezone</p>
              <p className="text-[11px] text-muted truncate max-w-[200px]">
                {getTimeZoneDisplayName(activeTimeZone, deviceTimeZone)}
              </p>
            </div>
            {isAuto ? (
              <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-strong">
                Auto
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-muted">
                Custom
              </span>
            )}
          </div>

          {/* Quick Action: Toggle between Local and Japan Release Time */}
          <div className="py-2 border-b border-border-subtle">
            <button
              type="button"
              onClick={handleToggleJapanLocal}
              className="w-full flex items-center justify-between rounded-xl border border-accent/30 bg-accent-soft px-3 py-2 text-xs font-semibold text-accent-strong hover:bg-accent/20 transition-colors"
            >
              <span>
                {isJapanTime
                  ? `Switch to My Timezone (${deviceAbbr})`
                  : "Switch to Japan Release Time (JST)"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/25">
                {isJapanTime ? "Local" : "JST"}
              </span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative my-2">
            <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-faint" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search timezones or cities…"
              className="w-full rounded-lg border border-border-subtle bg-surface-2 pl-8 pr-3 py-1.5 text-xs text-fg placeholder:text-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* Option list */}
          <div className="max-h-56 overflow-y-auto space-y-1 no-scrollbar pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted">
                No matching timezone found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected =
                  opt.value === "auto" ? isAuto : activeTimeZone === opt.value;
                const optAbbr =
                  opt.value === "auto"
                    ? deviceAbbr
                    : getTimeZoneAbbr(undefined, opt.value);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChoose(opt.value)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-accent/15 text-accent-strong font-semibold"
                        : "text-fg hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate leading-snug">{opt.label}</p>
                      {opt.value !== "auto" ? (
                        <p className="text-[10px] text-faint truncate font-mono">
                          {opt.value}
                        </p>
                      ) : (
                        <p className="text-[10px] text-faint truncate">
                          Detected: {deviceTimeZone}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      <span className="font-mono text-[11px] tabular-nums text-muted">
                        {optAbbr}
                      </span>
                      {isSelected ? (
                        <CheckIcon className="h-3.5 w-3.5 text-accent-strong" />
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
