/**
 * Copies text to the clipboard on web; falls back to the native share sheet
 * on iOS/Android (no expo-clipboard dependency — the share sheet offers
 * "Copy" and reaches the Claude app directly). Never rejects: clipboard
 * access can fail (missing focus/permission, Safari), callers get 'failed'
 * and show a hint instead of crashing.
 */
import { Platform, Share } from 'react-native';

export type CopyOutcome = 'copied' | 'shared' | 'failed';

function legacyWebCopy(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function copyOrShareText(text: string): Promise<CopyOutcome> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return 'copied';
      } catch {
        // e.g. document not focused or permission denied — try the legacy path
      }
    }
    return legacyWebCopy(text) ? 'copied' : 'failed';
  }
  try {
    await Share.share({ message: text });
    return 'shared';
  } catch {
    return 'failed';
  }
}
