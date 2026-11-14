// Login heart. Desktop: real 3D anatomical heart (Sketchfab "Heart - animated anatomical 3d model" by assetfactory,
// Sketchfab Standard licence) shown with <model-viewer>. Phones keep the animated Fluent heart (MIT), and users who
// ask for reduced motion get a still image.
import { useEffect, useState } from "react";
import heartBeating from "../assets/heart-beating.png";
import heart from "../assets/heart-3d.png";

const DESKTOP = "(min-width: 821px)";
const CALM = "(prefers-reduced-motion: reduce)";

function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const update = () => setMatches(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export default function LoginHeart() {
  const desktop = useMedia(DESKTOP);
  const calm = useMedia(CALM);
  const show3d = desktop && !calm;

  useEffect(() => {
    // Loaded only here, so other pages never download the 3D viewer.
    if (show3d) import("@google/model-viewer");
  }, [show3d]);

  if (show3d) {
    return (
      <figure className="login-heart login-heart-3d">
        {/* time-scale 1.8: the model's beat is 1.67 s; this makes it about 65 beats a minute.
            Drag (or arrow keys) to rotate; it turns again by itself 3 s after you let go. */}
        <model-viewer src="/models/heart-anatomical.glb" poster={heart}
          alt="3D model of a beating human heart. Drag or use the arrow keys to rotate it."
          autoplay="" time-scale="1.8" camera-controls="" disable-zoom="" disable-pan="" touch-action="pan-y"
          auto-rotate="" rotation-per-second="12deg" auto-rotate-delay="3000" interaction-prompt="none"
          camera-orbit="0deg 80deg auto" exposure="1.1" shadow-intensity="0" loading="eager" />
      </figure>
    );
  }
  return (
    <span className="login-heart" aria-hidden="true">
      <span className="beat-ring" />
      <span className="beat-ring beat-ring-late" />
      <picture>
        <source srcSet={heart} media={CALM} />
        <img src={heartBeating} alt="" width="256" height="256" />
      </picture>
    </span>
  );
}
