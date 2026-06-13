import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

export function Button(
	props: ButtonHTMLAttributes<HTMLButtonElement> & {
		variant?: ButtonVariant;
		buttonSize?: ButtonSize;
		children: ReactNode;
	},
) {
	const {
		variant = "secondary",
		buttonSize = "md",
		className,
		children,
		type = "button",
		...buttonProps
	} = props;

	return (
		<button
			{...buttonProps}
			type={type}
			className={[
				"ui-button",
				`ui-button-${variant}`,
				`ui-button-${buttonSize}`,
				className,
			]
				.filter(Boolean)
				.join(" ")}
		>
			{children}
		</button>
	);
}
