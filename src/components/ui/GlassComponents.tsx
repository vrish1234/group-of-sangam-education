import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { cn } from '@/src/lib/utils';

export type GlassCardProps = HTMLMotionProps<'div'> & {
  hover?: boolean;
};

export const GlassCard = ({ children, className, hover = true, ...props }: GlassCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass p-6 shadow-2xl shadow-black/20',
        hover && 'hover:scale-[1.01] hover:shadow-cyan-500/20',
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

export const GlassInput = ({ label, className, ...props }: GlassInputProps) => (
  <div className="space-y-1.5">
    {label && <label className="ml-1 text-sm font-medium text-slate-200">{label}</label>}
    <input
      className={cn(
        'w-full rounded-[20px] border border-white/20 bg-white/10 px-4 py-2.5 text-slate-100 placeholder:text-slate-300/60 focus:outline-none focus:ring-2 focus:ring-cyan-300/50',
        className
      )}
      {...props}
    />
  </div>
);

export type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
};

export const GlassButton = ({ children, variant = 'primary', size = 'md', isLoading, className, ...props }: GlassButtonProps) => {
  const variants = {
    primary: 'neon-primary text-white hover:scale-105',
    secondary: 'glass text-slate-100 hover:bg-white/15 hover:scale-105',
    danger: 'bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-lg shadow-red-500/30 hover:scale-105'
  };

  const sizes = {
    sm: 'px-4 py-1.5 text-sm',
    md: 'px-6 py-2.5',
    lg: 'px-8 py-3.5 text-lg'
  };

  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 rounded-[20px] font-medium transition-all duration-300', variants[variant], sizes[size], className)}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : children}
    </button>
  );
};
