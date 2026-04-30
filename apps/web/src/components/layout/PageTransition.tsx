import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type PageTransitionProps = {
  children: ReactNode;
};

export default function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className="motion-safe:animate-[page-enter_200ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
    >
      {children}
    </div>
  );
}
