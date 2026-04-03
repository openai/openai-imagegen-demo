import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type InputGroupProps = React.HTMLAttributes<HTMLDivElement>

const InputGroup = React.forwardRef<HTMLDivElement, InputGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group/input-group relative flex min-w-0 flex-wrap items-stretch gap-px rounded-xl bg-background/80 transition [--input-group-addon-gap:0.5rem] focus-within:ring-2 focus-within:ring-ring/40 focus-within:ring-offset-1",
          className,
        )}
        {...props}
      />
    )
  },
)
InputGroup.displayName = "InputGroup"

type InputGroupAddonAlign =
  | "inline-start"
  | "inline-end"
  | "block-start"
  | "block-end"

type InputGroupAddonProps = React.HTMLAttributes<HTMLDivElement> & {
  align?: InputGroupAddonAlign
}

const ALIGN_CLASSNAMES: Record<InputGroupAddonAlign, string> = {
  "inline-start": "order-0 inline-flex items-center gap-[--input-group-addon-gap] px-3 py-2",
  "inline-end": "order-1 ml-auto inline-flex items-center gap-[--input-group-addon-gap] px-3 py-2",
  "block-start": "order-0 flex w-full items-center gap-[--input-group-addon-gap] px-3 py-2",
  "block-end": "order-2 flex w-full items-center gap-[--input-group-addon-gap] px-3 py-2",
}

const InputGroupAddon = React.forwardRef<HTMLDivElement, InputGroupAddonProps>(
  ({ className, align = "inline-end", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-background/90 text-muted-foreground",
          ALIGN_CLASSNAMES[align],
          className,
        )}
        {...props}
      />
    )
  },
)
InputGroupAddon.displayName = "InputGroupAddon"

const inputGroupControlClasses =
  "flex-1 min-w-0 rounded-xl border-0 bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"

type InputGroupInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  asChild?: boolean
}

const InputGroupInput = React.forwardRef<HTMLInputElement, InputGroupInputProps>(
  ({ className, asChild, type, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          ref={ref as React.Ref<HTMLDivElement>}
          data-slot="input-group-control"
          className={cn(inputGroupControlClasses, className)}
          {...props}
        />
      )
    }

    return (
      <input
        ref={ref}
        type={type}
        data-slot="input-group-control"
        className={cn(inputGroupControlClasses, className)}
        {...props}
      />
    )
  },
)
InputGroupInput.displayName = "InputGroupInput"

type InputGroupTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const InputGroupTextarea = React.forwardRef<HTMLTextAreaElement, InputGroupTextareaProps>(
  ({ className, rows = 5, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        data-slot="input-group-control"
        className={cn(
          inputGroupControlClasses,
          "block field-sizing-content min-h-[180px] w-full resize-none leading-relaxed",
          className,
        )}
        {...props}
      />
    )
  },
)
InputGroupTextarea.displayName = "InputGroupTextarea"

type InputGroupButtonSize = "xs" | "icon-xs" | "sm" | "icon-sm"

type InputGroupButtonProps = Omit<ButtonProps, "size"> & {
  size?: InputGroupButtonSize
}

const INPUT_GROUP_BUTTON_SIZE: Record<InputGroupButtonSize, string> = {
  xs: "h-7 rounded-md px-2 text-xs",
  "icon-xs": "h-7 w-7 rounded-md",
  sm: "h-8 rounded-md px-3 text-sm",
  "icon-sm": "h-8 w-8 rounded-md",
}

const InputGroupButton = React.forwardRef<HTMLButtonElement, InputGroupButtonProps>(
  ({ className, size = "xs", variant = "ghost", ...props }, ref) => {
    const sizeKey: InputGroupButtonSize = size ?? "xs"
    return (
      <Button
        ref={ref}
        variant={variant}
        size="sm"
        className={cn(INPUT_GROUP_BUTTON_SIZE[sizeKey], className)}
        {...props}
      />
    )
  },
)
InputGroupButton.displayName = "InputGroupButton"

type InputGroupTextProps = React.HTMLAttributes<HTMLSpanElement>

const InputGroupText = React.forwardRef<HTMLSpanElement, InputGroupTextProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn("text-xs font-medium uppercase tracking-wide text-muted-foreground", className)}
      {...props}
    />
  ),
)
InputGroupText.displayName = "InputGroupText"

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
  InputGroupText,
}
