export const easeOutQuart = [0.165, 0.84, 0.44, 1] as const;
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export const reveal = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.24, ease: easeOutQuart },
};

export function staggered(delay: number) {
  return {
    ...reveal,
    transition: { duration: 0.24, ease: easeOutQuart, delay },
  };
}
