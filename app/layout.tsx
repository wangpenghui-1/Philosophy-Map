import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
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
    description: "在一个可进入的3D地球上，沿着问题、文本与有来源的关系探索世界哲学。",
    keywords: ["哲学", "思想史", "3D地球", "互动叙事", "Atlas of Ideas"],
    icons: {
      icon: "/globe.svg",
      shortcut: "/globe.svg",
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
