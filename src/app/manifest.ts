import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "안녕메디컬 정산",
    short_name: "안녕정산",
    description: "안녕메디컬 뷰티센터 매출/정산 관리",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#A26F54",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
