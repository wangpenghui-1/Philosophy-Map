import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { knowledgeBase } from "./_data/knowledge";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    metadataBase: new URL(origin),
    title: {
      default: "思想星图 · Atlas of Ideas",
      template: "%s · 思想星图",
    },
    description: `在一个可进入的3D地球与${knowledgeBase.people.length}人物知识库中，沿着问题、文本与有来源的关系探索世界哲学。`,
    keywords: ["哲学", "思想史", "3D地球", "互动叙事", "Atlas of Ideas"],
    manifest: "/site.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#b78e50" }],
    },
    openGraph: {
      title: "思想星图 · Atlas of Ideas",
      description: "人类在不同地方，如何回答相同的问题？",
      type: "website",
      locale: "zh_CN",
      images: [{ url: `${origin}/og.png`, width: 1733, height: 907, alt: "思想星图：黑金3D地球与跨文化思想关系" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "思想星图 · Atlas of Ideas",
      description: "人类在不同地方，如何回答相同的问题？",
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#050606",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
