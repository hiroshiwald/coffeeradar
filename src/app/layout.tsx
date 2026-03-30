import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CoffeeRadar",
  description: "Track new coffee releases from specialty roasters worldwide",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.theme==='dark'||(!localStorage.theme&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
