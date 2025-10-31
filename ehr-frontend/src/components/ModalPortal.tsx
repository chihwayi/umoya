import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

type ModalPortalProps = {
  children: React.ReactNode;
};

const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Render directly to body so no parent stacking context can interfere
  return createPortal(children, document.body);
};

export default ModalPortal;

