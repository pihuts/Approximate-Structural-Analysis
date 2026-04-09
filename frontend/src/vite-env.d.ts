/// <reference types="vite/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

declare module 'react-katex' {
  import type { ReactNode } from 'react';
  interface BlockMathProps {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => ReactNode;
  }
  interface InlineMathProps {
    math: string;
    errorColor?: string;
    renderError?: (error: Error) => ReactNode;
  }
  export const BlockMath: React.FC<BlockMathProps>;
  export const InlineMath: React.FC<InlineMathProps>;
}