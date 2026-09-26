import { useEffect } from 'react';
import type { JumpToCitationDetail } from '@/types';
import { JUMP_TO_CITATION_EVENT } from '@/types';

/**
 * Custom hook for dispatching and subscribing to citation jump events.
 */
export function useCitationJump(
  onJump?: (detail: JumpToCitationDetail) => void
) {
  const dispatchJump = (detail: JumpToCitationDetail) => {
    const event = new CustomEvent<JumpToCitationDetail>(JUMP_TO_CITATION_EVENT, {
      detail,
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    if (!onJump) return;

    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<JumpToCitationDetail>;
      if (customEvent.detail) {
        onJump(customEvent.detail);
      }
    };

    window.addEventListener(JUMP_TO_CITATION_EVENT, handleEvent);
    return () => {
      window.removeEventListener(JUMP_TO_CITATION_EVENT, handleEvent);
    };
  }, [onJump]);

  return { dispatchJump };
}
