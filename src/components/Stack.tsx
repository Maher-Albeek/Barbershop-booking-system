import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';

interface CardRotateProps {
  children: React.ReactNode;
  onSendToBack: () => void;
  sensitivity: number;
  disableDrag?: boolean;
}

const defaultCards = [
  {
    id: 1,
    content: (
      <img
        src="https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?q=80&w=500&auto=format"
        alt="card-1"
        className="w-full h-full object-cover pointer-events-none"
        loading="lazy"
        decoding="async"
      />
    )
  },
  {
    id: 2,
    content: (
      <img
        src="https://images.unsplash.com/photo-1449844908441-8829872d2607?q=80&w=500&auto=format"
        alt="card-2"
        className="w-full h-full object-cover pointer-events-none"
        loading="lazy"
        decoding="async"
      />
    )
  },
  {
    id: 3,
    content: (
      <img
        src="https://images.unsplash.com/photo-1452626212852-811d58933cae?q=80&w=500&auto=format"
        alt="card-3"
        className="w-full h-full object-cover pointer-events-none"
        loading="lazy"
        decoding="async"
      />
    )
  },
  {
    id: 4,
    content: (
      <img
        src="https://images.unsplash.com/photo-1572120360610-d971b9d7767c?q=80&w=500&auto=format"
        alt="card-4"
        className="w-full h-full object-cover pointer-events-none"
        loading="lazy"
        decoding="async"
      />
    )
  }
];

const CardRotate = memo(function CardRotate({ children, onSendToBack, sensitivity, disableDrag = false }: CardRotateProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [60, -60]);
  const rotateY = useTransform(x, [-100, 100], [-60, 60]);

  const handleDragEnd = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > sensitivity || Math.abs(info.offset.y) > sensitivity) {
      onSendToBack();
    } else {
      x.set(0);
      y.set(0);
    }
  }, [onSendToBack, sensitivity, x, y]);

  if (disableDrag) {
    return (
      <motion.div className="stack-rotate-card stack-rotate-card--click" style={{ x: 0, y: 0 }}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="stack-rotate-card stack-rotate-card--drag"
      style={{ x, y, rotateX, rotateY }}
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.6}
      whileTap={{ cursor: 'grabbing' }}
      onDragEnd={handleDragEnd}
    >
      {children}
    </motion.div>
  );
});

interface StackProps {
  randomRotation?: boolean;
  sensitivity?: number;
  sendToBackOnClick?: boolean;
  cards?: React.ReactNode[];
  animationConfig?: { stiffness: number; damping: number };
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  mobileClickOnly?: boolean;
  mobileBreakpoint?: number;
}

export default function Stack({
  randomRotation = false,
  sensitivity = 200,
  cards = [],
  animationConfig = { stiffness: 260, damping: 20 },
  sendToBackOnClick = false,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  mobileClickOnly = false,
  mobileBreakpoint = 768
}: StackProps) {
  const initialStack = useMemo(
    () => (cards.length ? cards.map((content, index) => ({ id: index + 1, content })) : defaultCards),
    [cards],
  );
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`).matches : false,
  );
  const [isPaused, setIsPaused] = useState(false);
  const [stack, setStack] = useState(initialStack);
  const rotations = useMemo(
    () => initialStack.map(() => (randomRotation ? Math.random() * 10 - 5 : 0)),
    [initialStack, randomRotation],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
    const updateMobile = () => setIsMobile((current) => (current === mediaQuery.matches ? current : mediaQuery.matches));
    updateMobile();
    mediaQuery.addEventListener('change', updateMobile);
    return () => mediaQuery.removeEventListener('change', updateMobile);
  }, [mobileBreakpoint]);

  const shouldDisableDrag = mobileClickOnly && isMobile;
  const shouldEnableClick = sendToBackOnClick || shouldDisableDrag;

  useEffect(() => {
    setStack(initialStack);
  }, [initialStack]);

  const sendToBack = useCallback((id: number) => {
    setStack(prev => {
      const newStack = [...prev];
      const index = newStack.findIndex(card => card.id === id);
      if (index < 0) return prev;
      const [card] = newStack.splice(index, 1);
      newStack.unshift(card);
      return newStack;
    });
  }, []);

  useEffect(() => {
    if (autoplay && stack.length > 1 && !isPaused) {
      const interval = setInterval(() => {
        const topCardId = stack[stack.length - 1].id;
        sendToBack(topCardId);
      }, autoplayDelay);

      return () => clearInterval(interval);
    }
  }, [autoplay, autoplayDelay, stack, isPaused, sendToBack]);

  const pauseStack = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const resumeStack = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  return (
    <div
      className="stack-root"
      style={{
        perspective: 600
      }}
      onMouseEnter={pauseStack}
      onMouseLeave={resumeStack}
    >
      {stack.map((card, index) => {
        const randomRotate = rotations[card.id - 1] ?? 0;
        return (
          <CardRotate
            key={card.id}
            onSendToBack={() => sendToBack(card.id)}
            sensitivity={sensitivity}
            disableDrag={shouldDisableDrag}
          >
            <motion.div
              className="stack-card"
              onClick={() => shouldEnableClick && sendToBack(card.id)}
              animate={{
                rotateZ: (stack.length - index - 1) * 4 + randomRotate,
                scale: 1 + index * 0.06 - stack.length * 0.06,
                transformOrigin: '90% 90%'
              }}
              initial={false}
              transition={{
                type: 'spring',
                stiffness: animationConfig.stiffness,
                damping: animationConfig.damping
              }}
            >
              {card.content}
            </motion.div>
          </CardRotate>
        );
      })}
    </div>
  );
}
