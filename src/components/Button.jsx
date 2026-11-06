import { forwardRef } from "react";

const Button = forwardRef(function Button(
  {
    as: Component = "button",
    children,
    className = "",
    variant = "secondary",
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <Component
      className={`button button--${variant} ${className}`.trim()}
      ref={ref}
      {...(Component === "button" ? { type } : {})}
      {...props}
    >
      {children}
    </Component>
  );
});

export default Button;
