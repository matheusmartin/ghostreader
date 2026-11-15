// Links to screens. Every screen has its own address, #/read/<book>/<chapter>/<n>, and the reader
// keeps the address bar on the current screen (main.ts), so a bookmark or a shared link opens the
// same screen. In full screen or in the installed app there is no address bar: the menu's
// "Share this screen" button uses the device's share sheet, or copies the link.

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareLink(url: string, title: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // Not allowed here (for example, no user gesture): fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return copyWithSelection(url) ? 'copied' : 'failed';
  }
}

/** Older browsers and insecure origins have no clipboard API: copy through a hidden text field. */
function copyWithSelection(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.append(field);
  field.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  field.remove();
  return ok;
}
