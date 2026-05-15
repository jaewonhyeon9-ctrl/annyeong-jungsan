import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BeautyChain",
    short_name: "BeautyChain",
    description: "다중 지점 뷰티/메디컬 센터 매출 · 환자 · 정산 통합 관리",
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
    ],
  };
}
