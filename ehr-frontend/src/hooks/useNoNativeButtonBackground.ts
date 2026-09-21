/**
 * A `<button>` relying on a transparent/tinted Tailwind background (bg-white/NN,
 * meant to tint through a colored header — modal close icons, etc.) can end up
 * rendered as an opaque white box: verified live that some engines mark the
 * native button face's background-image as `!important` in their UA
 * stylesheet, which only an author `!important` declaration can beat.
 * React's `style` prop can't express `!important` (it assigns
 * `element.style[prop] = value`, silently dropping any "!important" suffix),
 * so this ref callback uses `style.setProperty` directly with explicit
 * priority instead.
 */
export function noNativeButtonBackground(el: HTMLButtonElement | null): void {
  el?.style.setProperty('background-image', 'none', 'important');
}
