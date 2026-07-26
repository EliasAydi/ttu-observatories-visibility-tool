import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TTU Observatories Target Visibility Tool",
    short_name: "TTU Visibility",
    description:
      "Plan astronomical observations from TTU observatories using altitude, airmass, twilight, and Moon conditions.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#E90802",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}