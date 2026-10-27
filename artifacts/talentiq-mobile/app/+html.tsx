import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Root HTML layout for Expo Router Web.
 * Provides CSS resets to eliminate browser default white focus rings / outlines on inputs.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* Remove browser default focus outline / white selection box on all text inputs */
              input, textarea, select, [contenteditable="true"] {
                outline: none !important;
                outline-style: none !important;
                outline-width: 0 !important;
                outline-color: transparent !important;
                box-shadow: none !important;
                -webkit-tap-highlight-color: transparent !important;
              }
              input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus,
              input:focus-visible, textarea:focus-visible {
                outline: none !important;
                outline-style: none !important;
                outline-width: 0 !important;
                outline-color: transparent !important;
                box-shadow: none !important;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
