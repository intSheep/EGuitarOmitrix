import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps } from "react";
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
// shadcn-style owned primitive; variants retain the approved tactile visual system.
const variants = cva(
  "button focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "primary",
        secondary: "secondary",
        link: "text-link",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component className={cn(variants({ variant }), className)} {...props} />
  );
}
