/**
 * 启动加载屏幕
 * 显示应用启动时的加载动画
 */

interface LoadingScreenProps {
  progress?: number
  status?: string
}

export default function LoadingScreen({ progress = 0, status = 'Initializing...' }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[9999]">
      {/* Logo */}
      <div className="mb-8 relative">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center border border-white/10 shadow-2xl">
          <svg
            className="w-10 h-10 text-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
            <line x1="12" y1="2" x2="12" y2="22" className="opacity-30" />
          </svg>
        </div>
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-xl -z-10 animate-pulse" />
      </div>

      {/* App Name */}
      <h1 className="text-2xl font-bold text-text-primary mb-2 tracking-tight">
        Adnify
      </h1>
      <p className="text-sm text-text-muted mb-8">AI-Powered Code Editor</p>

      {/* Progress Bar */}
      <div className="w-64 h-1 bg-surface rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-accent to-purple-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status Text */}
      <p className="text-xs text-text-muted">{status}</p>

      {/* Loading Dots */}
      <div className="flex gap-1 mt-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-accent/50"
            style={{
              animation: 'bounce 1s infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          40% {
            transform: translateY(-8px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
