"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export function CustomCursor(): ReactNode {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    setIsDark(html.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains("dark"));
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springX = useSpring(cursorX, { stiffness: 500, damping: 28 });
  const springY = useSpring(cursorY, { stiffness: 500, damping: 28 });

  useEffect(() => {
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsTouchDevice(isTouch);
    if (isTouch) return;

    function onMouseMove(e: MouseEvent) {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      setIsVisible(true);
    }

    function onMouseLeave() {
      setIsVisible(false);
    }

    function onMouseEnter() {
      setIsVisible(true);
    }

    function checkHover() {
      const hovered = document.querySelectorAll(
        "a, button, [role='button'], input, textarea, select, [data-cursor-hover]"
      );

      hovered.forEach((el) => {
        el.addEventListener("mouseenter", () => setIsHovering(true));
        el.addEventListener("mouseleave", () => setIsHovering(false));
      });
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    checkHover();

    const observer = new MutationObserver(checkHover);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      observer.disconnect();
    };
  }, [cursorX, cursorY]);

  if (isTouchDevice) return null;

  return (
    <>
      <motion.div
        className={`pointer-events-none fixed top-0 left-0 z-[999] rounded-full mix-blend-difference ${
          isDark ? "bg-white" : "bg-accent"
        }`}
        style={{
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: isHovering ? 48 : 8,
          height: isHovering ? 48 : 8,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{
          width: { type: "spring", stiffness: 300, damping: 20 },
          height: { type: "spring", stiffness: 300, damping: 20 },
          opacity: { duration: 0.15 },
        }}
      />
      <motion.div
        className={`pointer-events-none fixed top-0 left-0 z-[998] rounded-full border ${
          isDark ? "border-white/30" : "border-accent/40"
        }`}
        style={{
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          width: isHovering ? 60 : 32,
          height: isHovering ? 60 : 32,
          opacity: isVisible ? 0.5 : 0,
        }}
        transition={{
          width: { type: "spring", stiffness: 200, damping: 20 },
          height: { type: "spring", stiffness: 200, damping: 20 },
          opacity: { duration: 0.15 },
        }}
      />
    </>
  );
}
