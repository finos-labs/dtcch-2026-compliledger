"use client";

import { useRef, useState, type ReactNode, type MouseEvent } from "react";
import { motion } from "motion/react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  tiltStrength?: number;
  glareEnabled?: boolean;
}

export function TiltCard({
  children,
  className = "",
  tiltStrength = 10,
  glareEnabled = true,
}: TiltCardProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({
    rotateX: 0,
    rotateY: 0,
    glareX: 50,
    glareY: 50,
  });
  const [isHovered, setIsHovered] = useState(false);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - y) * tiltStrength;
    const rotateY = (x - 0.5) * tiltStrength;
    setTransform({
      rotateX,
      rotateY,
      glareX: x * 100,
      glareY: y * 100,
    });
  }

  function handleMouseEnter() {
    setIsHovered(true);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    setTransform({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX: transform.rotateX,
        rotateY: transform.rotateY,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative ${className}`}
      style={{ perspective: 800, transformStyle: "preserve-3d" }}
    >
      {children}
      {glareEnabled && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          animate={{ opacity: isHovered ? 0.12 : 0 }}
          transition={{ duration: 0.3 }}
          style={{
            background: `radial-gradient(circle at ${transform.glareX}% ${transform.glareY}%, rgba(255,255,255,0.4) 0%, transparent 60%)`,
          }}
        />
      )}
    </motion.div>
  );
}
