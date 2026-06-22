'use client';

import { useToast } from './ToastProvider';

function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
    }
  } catch {
    /* clipboard unavailable — ignore */
  }
}

export function useShare() {
  const toast = useToast();

  return {
    copy(url: string, message: string) {
      copyText(url);
      toast(message);
    },
    whatsapp(text: string, url: string) {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
        '_blank',
        'noopener',
      );
    },
    email(subject: string, body: string) {
      window.location.href = `mailto:?subject=${encodeURIComponent(
        subject,
      )}&body=${encodeURIComponent(body)}`;
    },
  };
}
