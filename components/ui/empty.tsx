import * as React from "react"

import { cn } from "@/lib/utils"

type EmptyProps = React.HTMLAttributes<HTMLDivElement>

const Empty = React.forwardRef<HTMLDivElement, EmptyProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20 px-6 py-10 text-center",
        className,
      )}
      {...props}
    />
  ),
)
Empty.displayName = "Empty"

type EmptyHeaderProps = React.HTMLAttributes<HTMLDivElement>

const EmptyHeader = React.forwardRef<HTMLDivElement, EmptyHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col items-center gap-2", className)}
      {...props}
    />
  ),
)
EmptyHeader.displayName = "EmptyHeader"

type EmptyContentProps = React.HTMLAttributes<HTMLDivElement>

const EmptyContent = React.forwardRef<HTMLDivElement, EmptyContentProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mt-4 flex flex-col items-center gap-2", className)}
      {...props}
    />
  ),
)
EmptyContent.displayName = "EmptyContent"

type EmptyMediaVariant = "default" | "icon"

type EmptyMediaProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: EmptyMediaVariant
}

const MEDIA_VARIANT_CLASSNAMES: Record<EmptyMediaVariant, string> = {
  default:
    "flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 bg-background text-muted-foreground",
  icon:
    "flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 bg-background text-muted-foreground",
}

const EmptyMedia = React.forwardRef<HTMLDivElement, EmptyMediaProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(MEDIA_VARIANT_CLASSNAMES[variant], className)}
      {...props}
    />
  ),
)
EmptyMedia.displayName = "EmptyMedia"

type EmptyTitleProps = React.HTMLAttributes<HTMLHeadingElement>

const EmptyTitle = React.forwardRef<HTMLHeadingElement, EmptyTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  ),
)
EmptyTitle.displayName = "EmptyTitle"

type EmptyDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>

const EmptyDescription = React.forwardRef<HTMLParagraphElement, EmptyDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("max-w-sm text-sm text-muted-foreground", className)}
      {...props}
    />
  ),
)
EmptyDescription.displayName = "EmptyDescription"

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle }
