import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>mydoc.ai</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: webStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const webStyles = `
  * { box-sizing: border-box; }

  body {
    background: #0f172a;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 100vh;
    margin: 0;
    padding: 24px 0;
  }

  #root {
    width: 390px;
    min-height: 844px;
    height: calc(100vh - 48px);
    background: #F9FAFB;
    border-radius: 44px;
    overflow: hidden;
    position: relative;
    box-shadow:
      0 0 0 10px #1e293b,
      0 0 0 12px #334155,
      0 0 60px rgba(0,0,0,0.6);
  }

  /* Fake iPhone notch */
  #root::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 126px;
    height: 34px;
    background: #0f172a;
    border-radius: 0 0 20px 20px;
    z-index: 9999;
  }
`;
