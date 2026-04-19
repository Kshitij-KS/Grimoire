import { cn } from "@/lib/utils";

export function LoadingSpinner({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <div 
      className={cn("relative flex items-center justify-center shrink-0", className)} 
      style={{ width: size, height: size }}
    >
      {/* Orbiting ring */}
      <div 
        className="absolute inset-0 rounded-full border-[2px] border-current border-t-transparent border-r-transparent opacity-80"
        style={{
          animation: 'spin 0.8s cubic-bezier(0.35, 0.1, 0.25, 1) infinite'
        }} 
      />
      {/* Inner glowing pulse */}
      <div 
        className="absolute inset-[30%] rounded-full bg-current opacity-60 blur-[2px]"
        style={{
          animation: 'pulse 1.5s cubic-bezier(0.23, 1, 0.32, 1) infinite alternate'
        }}
      />
      {/* Reverse orbiting dot */}
      <div 
        className="absolute inset-0"
        style={{
          animation: 'spin 1.2s cubic-bezier(0.77, 0, 0.175, 1) infinite reverse'
        }}
      >
        <div className="absolute top-[10%] left-[10%] h-[15%] w-[15%] rounded-full bg-current opacity-90 blur-[0.5px]" />
      </div>
    </div>
  );
}
