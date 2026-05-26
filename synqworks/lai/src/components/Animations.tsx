import React, { useState, useEffect, ReactNode } from "react";

// Animated Button Component
interface AnimatedButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  className?: string;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const variants = {
    primary:
      "bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border-blue-400/30",
    secondary: "bg-white/10 hover:bg-white/20 text-white border-white/20",
    ghost:
      "bg-transparent hover:bg-white/10 text-white/80 hover:text-white border-transparent",
    danger: "bg-red-500/20 hover:bg-red-500/30 text-red-200 border-red-400/30",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        border rounded-xl font-medium
        transition-all duration-150 ease-out
        transform hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-blue-400/50
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${isPressed ? "scale-95" : ""}
        ${isLoading ? "cursor-wait" : "cursor-pointer"}
        gpu-accelerated
        ${className}
      `}
      disabled={isLoading}
    >
      <div className="flex items-center justify-center space-x-2">
        {isLoading && (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <span>{children}</span>
      </div>
    </button>
  );
};

// Fade In Animation Component
interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export const FadeIn: React.FC<FadeInProps> = ({
  children,
  delay = 0,
  duration = 500,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`
        transition-all ease-out
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        ${className}
      `}
      style={{ transitionDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
};

// Stagger Container for sequential animations
interface StaggerContainerProps {
  children: ReactNode[];
  staggerDelay?: number;
  className?: string;
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  staggerDelay = 100,
  className = "",
}) => {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <FadeIn key={index} delay={index * staggerDelay}>
          {child}
        </FadeIn>
      ))}
    </div>
  );
};

// Pulse Animation Component
interface PulseProps {
  children: ReactNode;
  isActive?: boolean;
  intensity?: "subtle" | "normal" | "strong";
  className?: string;
}

export const Pulse: React.FC<PulseProps> = ({
  children,
  isActive = true,
  intensity = "normal",
  className = "",
}) => {
  const intensities = {
    subtle: "animate-pulse",
    normal: "animate-pulse",
    strong: "animate-bounce",
  };

  return (
    <div className={`${isActive ? intensities[intensity] : ""} ${className}`}>
      {children}
    </div>
  );
};

// Slide In Animation
interface SlideInProps {
  children: ReactNode;
  direction?: "left" | "right" | "up" | "down";
  delay?: number;
  className?: string;
}

export const SlideIn: React.FC<SlideInProps> = ({
  children,
  direction = "up",
  delay = 0,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const directions = {
    left: isVisible ? "translate-x-0" : "-translate-x-8",
    right: isVisible ? "translate-x-0" : "translate-x-8",
    up: isVisible ? "translate-y-0" : "translate-y-8",
    down: isVisible ? "translate-y-0" : "-translate-y-8",
  };

  return (
    <div
      className={`
        transform transition-all duration-500 ease-out
        ${directions[direction]}
        ${isVisible ? "opacity-100" : "opacity-0"}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// Scale Animation Component
interface ScaleProps {
  children: ReactNode;
  isHovered?: boolean;
  isPressed?: boolean;
  className?: string;
}

export const Scale: React.FC<ScaleProps> = ({
  children,
  isHovered = false,
  isPressed = false,
  className = "",
}) => {
  let scaleClass = "scale-100";

  if (isPressed) {
    scaleClass = "scale-95";
  } else if (isHovered) {
    scaleClass = "scale-105";
  }

  return (
    <div
      className={`transform transition-transform duration-200 ease-out ${scaleClass} ${className}`}
    >
      {children}
    </div>
  );
};

// Loading Spinner Component with 530ms blink rate
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
  variant?: "spinner" | "dots" | "pulse";
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  color = "currentColor",
  className = "",
  variant = "spinner",
}) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  if (variant === "dots") {
    // Three dots with 530ms blink animation
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div
          className={`${size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-2.5 h-2.5" : "w-2 h-2"} rounded-full bg-current animate-pulse`}
          style={{ animationDuration: "530ms", animationDelay: "0ms" }}
        />
        <div
          className={`${size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-2.5 h-2.5" : "w-2 h-2"} rounded-full bg-current animate-pulse`}
          style={{ animationDuration: "530ms", animationDelay: "177ms" }}
        />
        <div
          className={`${size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-2.5 h-2.5" : "w-2 h-2"} rounded-full bg-current animate-pulse`}
          style={{ animationDuration: "530ms", animationDelay: "354ms" }}
        />
      </div>
    );
  }

  if (variant === "pulse") {
    // Pulsing circle with 530ms animation
    return (
      <div
        className={`${sizes[size]} rounded-full bg-current animate-pulse ${className}`}
        style={{ animationDuration: "530ms" }}
      />
    );
  }

  // Default spinning spinner
  return (
    <div
      className={`
        ${sizes[size]}
        border-2 border-t-transparent rounded-full animate-spin
        ${className}
      `}
      style={{
        borderColor: `${color} transparent transparent transparent`,
        animationDuration: "600ms", // Slightly faster spin
      }}
    />
  );
};

// Progress Bar Component
interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className = "",
  showPercentage = false,
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-2">
        {showPercentage && (
          <span className="text-sm text-white/60">{Math.round(progress)}%</span>
        )}
      </div>
      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-400 to-purple-500 h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
};

// Typing Cursor Animation for streaming responses
export const TypingCursor: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return (
    <span
      className={`inline-block w-0.5 h-4 bg-current animate-pulse ${className}`}
      style={{ animationDuration: "530ms" }}
    />
  );
};

// Typing Indicator (three dots) for "Assistant is typing..."
export const TypingIndicator: React.FC<{ className?: string }> = ({
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div
        className="w-2 h-2 rounded-full bg-current animate-bounce"
        style={{ animationDuration: "530ms", animationDelay: "0ms" }}
      />
      <div
        className="w-2 h-2 rounded-full bg-current animate-bounce"
        style={{ animationDuration: "530ms", animationDelay: "177ms" }}
      />
      <div
        className="w-2 h-2 rounded-full bg-current animate-bounce"
        style={{ animationDuration: "530ms", animationDelay: "354ms" }}
      />
    </div>
  );
};

// Skeleton Screen Component for loading states
interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string;
  height?: string;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  variant = "text",
  width = "100%",
  height = variant === "text" ? "1rem" : "3rem",
  lines = 1,
}) => {
  const baseClasses = "animate-pulse bg-gray-300 dark:bg-gray-700";

  if (variant === "circular") {
    return (
      <div
        className={`${baseClasses} rounded-full ${className}`}
        style={{ width, height }}
      />
    );
  }

  if (variant === "text" && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} rounded`}
            style={{
              width: i === lines - 1 ? "80%" : width,
              height,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${variant === "text" ? "rounded" : "rounded-lg"} ${className}`}
      style={{ width, height }}
    />
  );
};

// Animated Card Component
interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = "",
  delay = 0,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <FadeIn delay={delay}>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          transform transition-all duration-300 ease-out
          ${isHovered ? "scale-[1.02] shadow-2xl" : "scale-100 shadow-lg"}
          ${className}
        `}
      >
        {children}
      </div>
    </FadeIn>
  );
};

export default {
  AnimatedButton,
  FadeIn,
  StaggerContainer,
  Pulse,
  SlideIn,
  Scale,
  LoadingSpinner,
  ProgressBar,
  AnimatedCard,
  TypingCursor,
  TypingIndicator,
  Skeleton,
};
