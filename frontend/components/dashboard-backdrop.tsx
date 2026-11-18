"use client";

import { useEffect, useState } from "react";
import { SCENE_IMAGE, type WeatherScene } from "@/lib/weather-scene";

const FALLBACK = "/weather/sunset.jpg";

export function DashboardBackdrop({ scene }: { scene: WeatherScene }) {
  const image = SCENE_IMAGE[scene];
  const [src, setSrc] = useState(image.jpg);

  useEffect(() => {
    setSrc(image.jpg);
    const preload = new Image();
    preload.src = image.webp;
  }, [image.jpg, image.webp]);

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <picture className="absolute inset-x-0 top-0 h-[88%]">
        <source srcSet={image.webp} type="image/webp" />
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: "center 40%" }}
          onError={() => {
            if (src !== FALLBACK) setSrc(FALLBACK);
          }}
        />
      </picture>
      <div className="dash-photo-scrim" />
    </div>
  );
}
