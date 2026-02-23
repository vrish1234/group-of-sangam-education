import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { cn } from '@/src/lib/utils';

export type GlassCardProps = HTMLMotionProps<"div"> & {
  hover?: boolean;
};

export const GlassCard = ({ children, className, hover = true, ...props }: GlassCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass rounded-2xl p-6",
        hover && "transition-all duration-300 hover:bg-white/15 hover:border-white/30",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export type GlassInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const GlassInput = ({ label, className, ...props }: GlassInputProps) => {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-sm font-medium text-slate-300 ml-1">{label}</label>}
      <input
        className={cn(
          "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all",
          className
        )}
        {...props}
      />
    </div>
  );
};

export type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
};

export const GlassButton = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isLoading,
  className, 
  ...props 
}: GlassButtonProps) => {
  const variants = {
    primary: "bg-teal-500/80 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/20",
    secondary: "bg-white/10 hover:bg-white/20 text-white border border-white/10",
    danger: "bg-red-500/80 hover:bg-red-400 text-white shadow-lg shadow-red-500/20"
  };

  const sizes = {
    sm: "px-4 py-1.5 text-sm",
    md: "px-6 py-2.5",
    lg: "px-8 py-3.5 text-lg"
  };

  return (
    <button
      className={cn(
        "glass-button inline-flex items-center justify-center gap-2 font-medium",
        variants[variant],
        sizes[size],
        isLoading && "opacity-70 cursor-not-allowed",
        className
      )}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
};
