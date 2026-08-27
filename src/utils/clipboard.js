// Copy text to the clipboard, working in both desktop browsers and the
// Capacitor Android WebView — where navigator.clipboard is often unavailable,
// blocked, or throws without a user gesture. Falls back to a hidden textarea +
// execCommand('copy'), which works inside the app WebView.
// Returns a Promise<boolean> (true = copied).
export async function copyText(text) {
  if (!text) return false;

  // Preferred path — the async Clipboard API (secure contexts / modern WebView).
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  // Legacy fallback — reliable inside Android WebViews.
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
