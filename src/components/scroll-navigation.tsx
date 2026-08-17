"use client";

import { useEffect, useState } from "react";

function ArrowIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "up" ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

export function ScrollNavigation() {
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateNavigation = () => {
      const maximumScroll = document.documentElement.scrollHeight - window.innerHeight;

      setIsVisible(maximumScroll > 80);
      setDirection(window.scrollY >= maximumScroll / 2 ? "up" : "down");
    };

    updateNavigation();
    window.addEventListener("scroll", updateNavigation, { passive: true });
    window.addEventListener("resize", updateNavigation);

    const resizeObserver = new ResizeObserver(updateNavigation);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener("scroll", updateNavigation);
      window.removeEventListener("resize", updateNavigation);
      resizeObserver.disconnect();
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  const isGoingUp = direction === "up";

  function handleScroll() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({
      top: isGoingUp ? 0 : document.documentElement.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  return (
    <button
      type="button"
      className="scroll-navigation"
      onClick={handleScroll}
      aria-label={isGoingUp ? "Ir al inicio de la página" : "Ir al final de la página"}
      title={isGoingUp ? "Ir al inicio" : "Ir al final"}
    >
      <ArrowIcon direction={direction} />
      <span className="sr-only">{isGoingUp ? "Ir al inicio de la página" : "Ir al final de la página"}</span>
    </button>
  );
}
