import { motion } from 'framer-motion'
import { Briefcase, Loader2, ShieldCheck, Inbox, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

const HIGHLIGHTS = [
  {
    icon: Inbox,
    title: 'Your inbox, your entries',
    body: 'Gmail is read through your own Google account. Nobody else can see it.',
  },
  {
    icon: Lock,
    title: 'Private by default',
    body: 'Applications stay in this browser. No shared database, no one else’s rows.',
  },
  {
    icon: ShieldCheck,
    title: 'Sign out any time',
    body: 'Signing out revokes access and forgets your Gmail connection.',
  },
]

export default function LoginScreen({ onSignIn, pending, error }) {
  return (
    <div className="min-h-screen mesh-bg relative flex items-center justify-center px-4 py-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[360px] sm:w-[600px] h-[360px] sm:h-[600px] rounded-full opacity-50 blur-[100px] animate-float"
          style={{
            background:
              'radial-gradient(circle, rgba(137,180,250,0.18) 0%, rgba(100,140,255,0.12) 40%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-[35%] -left-40 w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] rounded-full opacity-40 blur-[100px] animate-float2"
          style={{
            background:
              'radial-gradient(circle, rgba(0,255,136,0.1) 0%, rgba(0,200,255,0.08) 35%, rgba(100,80,255,0.06) 60%, transparent 80%)',
          }}
        />
      </div>

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="glass-strong rounded-[24px] p-7 sm:p-9 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/10 blur-[80px]" />

          <div className="relative">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">Job Tracker</h1>
                <p className="text-xs text-neutral-500">Track • Organize • Get hired</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold tracking-tight leading-tight text-white">
              Sign in to start <span className="bg-gradient-to-r from-blue-500 via-blue-400 to-blue-300 bg-clip-text text-transparent">tracking.</span>
            </h2>
            <p className="text-sm text-neutral-400 mt-3 leading-relaxed">
              Use your Google account. It identifies you and, when you want, lets the app read
              your inbox to find application emails.
            </p>

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              onClick={onSignIn}
              disabled={pending}
              className="mt-6 h-12 w-full rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-xl shadow-blue-500/25 border-0 gap-2 text-base font-semibold"
            >
              {pending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.14 6.16-4.14Z"
                  />
                </svg>
              )}
              {pending ? 'Redirecting…' : 'Continue with Google'}
            </Button>

            <p className="mt-4 text-[11px] text-neutral-600 text-center leading-relaxed">
              We request read-only access to Gmail, and only when you press Sync.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {HIGHLIGHTS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.45 }}
              className="glass rounded-2xl p-4 flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">{item.title}</div>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{item.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
