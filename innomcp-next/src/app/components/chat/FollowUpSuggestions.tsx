"use client";

import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type FC,
} from "react";

export interface FollowUpSuggestionsProps {
	suggestions: string[];
	onSelect: (suggestion: string) => void;
	className?: string;
}

const FollowUpSuggestions: FC<FollowUpSuggestionsProps> = ({
	suggestions,
	onSelect,
	className,
}) => {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [isScrollable, setIsScrollable] = useState(false);

	const checkOverflow = useCallback(() => {
		const el = scrollRef.current;
		if (el) {
			setIsScrollable(el.scrollWidth > el.clientWidth);
		}
	}, []);

	useEffect(() => {
		checkOverflow();
		const observer = new ResizeObserver(checkOverflow);
		if (scrollRef.current) {
			observer.observe(scrollRef.current);
		}
		return () => observer.disconnect();
	}, [checkOverflow, suggestions]);

	useEffect(() => {
		checkOverflow();
	}, [suggestions, checkOverflow]);

	return (
		<div className={`relative ${className ?? ""}`}>
			{/* Scroll container */}
			<div
				ref={scrollRef}
				className="flex overflow-x-auto gap-2 py-1 no-scrollbar scroll-smooth"
				style={{
					// Hide scrollbar without breaking functionality
					scrollbarWidth: "none",
					msOverflowStyle: "none",
				}}
			>
				{suggestions.map((suggestion, index) => (
					<button
						key={suggestion}
						type="button"
						onClick={() => onSelect(suggestion)}
						className="flex-shrink-0 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600
                                   hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors
                                   truncate max-w-[60ch] text-left
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
						style={{
							opacity: 0,
							animation: `follow-up-slide-up 0.3s ease-out forwards`,
							animationDelay: `${index * 80}ms`,
						}}
					>
						{suggestion}
					</button>
				))}
			</div>

			{/* Gradient fade overlay – visible only when scrollable */}
			{isScrollable && (
				<div
					aria-hidden="true"
					className="absolute top-0 right-0 h-full w-12 pointer-events-none
                               bg-gradient-to-l from-white dark:from-gray-950 to-transparent"
				/>
			)}

			{/* Global keyframes for entry animation */}
			<style jsx>{`
				@keyframes follow-up-slide-up {
					from {
						opacity: 0;
						transform: translateY(10px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
				/* Hide scrollbar cross-browser */
				.no-scrollbar::-webkit-scrollbar {
					display: none;
				}
			`}</style>
		</div>
	);
};

export default FollowUpSuggestions;