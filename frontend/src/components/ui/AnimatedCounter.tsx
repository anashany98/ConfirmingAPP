import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";

export function AnimatedCounter({
    value,
    direction = "up",
    formatter = (v: number) => v.toString(),
}: {
    value: number;
    direction?: "up" | "down";
    formatter?: (v: number) => string;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(direction === "down" ? value : 0);
    const springValue = useSpring(motionValue, {
        damping: 100,
        stiffness: 100,
    });
    const isInView = useInView(ref, { once: true, margin: "-100px" });

    useEffect(() => {
        if (isInView) {
            motionValue.set(direction === "down" ? 0 : value);
        }
    }, [motionValue, isInView, value, direction]);

    useEffect(() => {
        springValue.on("change", (latest) => {
            if (ref.current) {
                ref.current.textContent = formatter(parseFloat(latest.toFixed(2)));
            }
        });
    }, [springValue, formatter]);

    return <span ref={ref} />;
}
