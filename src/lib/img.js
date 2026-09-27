// A 1x1 transparent-ish neutral tile, inlined so the fallback needs no
// network request of its own. Used as the `src` for any <img> that fails
// to load, so a rare CDN hiccup shows a plain soft panel instead of a
// broken-image icon.
const FALLBACK_SRC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="rgb(24,29,42)"/></svg>'
  )

export function handleImgError(e) {
  if (e.target.src !== FALLBACK_SRC) {
    e.target.src = FALLBACK_SRC
    e.target.classList.add('object-cover')
  }
}
