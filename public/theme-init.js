(function () {
  try {
    var stored = localStorage.getItem("kaze-theme");
    var mode =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "dark";
    var resolved =
      mode === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : mode;
    var design = localStorage.getItem("kaze-design");
    if (
      design !== "broadcast" &&
      design !== "editorial" &&
      design !== "shelf"
    ) {
      design = "broadcast";
    }
    var root = document.documentElement;
    root.dataset.design = design;
    root.classList.toggle("light", resolved === "light");
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  } catch {}
})();
