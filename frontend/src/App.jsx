import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Trash2, Search, Loader2, Briefcase, Sparkles, TrendingUp,
  Building2, Mail, Zap, Filter, Calendar, ArrowUpRight,
  CircleDot, CheckCircle2, XCircle, Clock3, Layers,
  LogOut, Menu, X
} from "lucide-react"

function App() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isGmailConnected, setIsGmailConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)

  // Always dark
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  const fetchJobs = () => {
    fetch('http://localhost:8000/api/jobs')
      .then(r => r.json())
      .then(data => { setJobs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchJobs()
    fetch('http://localhost:8000/auth/status')
      .then(res => res.json())
      .then(data => setIsGmailConnected(data.connected))
      .catch(() => {})
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const today = new Date().toISOString().split('T')[0]
    fetch('http://localhost:8000/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company, role, date: today, status: 'Applied' }),
    }).then(() => { setCompany(''); setRole(''); fetchJobs() })
  }

  const handleStatusChange = (jobId, newStatus, jobData) => {
    fetch(`http://localhost:8000/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...jobData, status: newStatus }),
    }).then(() => fetchJobs())
  }

  const handleDelete = (jobId) => {
    if (!window.confirm("Delete this application?")) return
    fetch(`http://localhost:8000/api/jobs/${jobId}`, { method: 'DELETE' }).then(() => fetchJobs())
  }

  const handleGmailLogin = () => {
    fetch('http://localhost:8000/auth/login')
      .then(res => res.json())
      .then(data => { window.location.href = data.url })
  }

  const handleSyncGmail = () => {
    setIsSyncing(true)
    fetch('http://localhost:8000/api/sync-gmail', { method: 'POST' })
      .then(res => res.json())
      .then(data => { alert(data.message); fetchJobs(); setIsSyncing(false) })
      .catch(() => setIsSyncing(false))
  }

  const handleLogout = () => {
    fetch('http://localhost:8000/auth/logout', { method: 'POST' })
      .then(res => {
        setIsGmailConnected(false)
        if (res.ok) window.location.href = '/'
      })
      .catch(() => setIsGmailConnected(false))
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.role.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'All' || job.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [jobs, searchTerm, statusFilter])

  const stats = useMemo(() => {
    const total = jobs.length
    const applied = jobs.filter(j => j.status === 'Applied').length
    const interview = jobs.filter(j => j.status === 'Interview').length
    const offer = jobs.filter(j => j.status === 'Offer').length
    return { total, applied, interview, offer }
  }, [jobs])

  const getStatusMeta = (status) => {
    switch(status) {
      case 'Interview': return { dot: 'bg-emerald-500', icon: CheckCircle2 }
      case 'Rejected': return { dot: 'bg-red-500', icon: XCircle }
      case 'Offer': return { dot: 'bg-blue-500', icon: Sparkles }
      default: return { dot: 'bg-sky-500', icon: Clock3 }
    }
  }

  const filterPills = ['All', 'Applied', 'Interview', 'Offer', 'Rejected']

  return (
    <div className="min-h-screen mesh-bg relative">
      {/* GSAP-style ambient orbs — sapphire blue + neon green */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[360px] sm:w-[600px] h-[360px] sm:h-[600px] rounded-full opacity-50 blur-[100px] animate-float"
          style={{ background: 'radial-gradient(circle, rgba(137,180,250,0.18) 0%, rgba(100,140,255,0.12) 40%, transparent 70%)' }} />
        <div className="absolute top-[35%] -left-40 w-[400px] sm:w-[550px] h-[400px] sm:h-[550px] rounded-full opacity-40 blur-[100px] animate-float2"
          style={{ background: 'radial-gradient(circle, rgba(0,255,136,0.1) 0%, rgba(0,200,255,0.08) 35%, rgba(100,80,255,0.06) 60%, transparent 80%)' }} />
        <div className="absolute -bottom-40 right-[5%] sm:right-[15%] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full opacity-30 blur-[90px] animate-float3"
          style={{ background: 'radial-gradient(circle, rgba(137,180,250,0.12) 0%, rgba(100,140,255,0.08) 40%, transparent 70%)' }} />
        {/* Accent glow dot */}
        <div className="absolute top-[15%] left-[60%] w-96 h-96 sm:w-[400px] sm:h-[400px] rounded-full opacity-20 blur-[120px] animate-float"
          style={{ background: 'radial-gradient(circle, rgba(0,255,136,0.15) 0%, transparent 60%)' }} />
      </div>

      {/* ── Header ── */}
      <motion.header
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-40 backdrop-blur-xl bg-black/30 dark:bg-black/30 border-b border-white/[0.06] dark:border-white/[0.06]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <motion.div
              whileHover={{ rotate: 8, scale: 1.05 }}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0"
            >
              <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </motion.div>
            <div className="min-w-0">
              <h1 className="text-[18px] sm:text-2xl font-bold tracking-tight leading-none flex items-center gap-2">
                <span className="truncate">Job Tracker</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-blue-500 text-white shrink-0">GSAP</span>
              </h1>
              <p className="text-xs text-neutral-500 hidden lg:block">Track • Organize • Land your dream role</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Desktop actions */}
            <div className="hidden sm:flex items-center gap-2">
              {isGmailConnected ? (
                <>
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="hidden lg:flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow shadow-emerald-500/50" />
                    Gmail Connected
                  </motion.div>
                  <Button onClick={handleSyncGmail} disabled={isSyncing} size="sm"
                    className="rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30 border-0 gap-1.5">
                    {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    <span className="hidden lg:inline">{isSyncing ? 'Syncing…' : 'Sync Gmail'}</span>
                    <span className="lg:hidden">Sync</span>
                  </Button>
                  <Button onClick={handleLogout} variant="ghost" size="sm"
                    className="rounded-full glass bg-white/[0.06] hover:bg-red-500/10 border-white/[0.08] text-neutral-300 hover:text-red-400 gap-1.5">
                    <LogOut className="h-4 w-4" /> <span className="hidden lg:inline">Logout</span>
                  </Button>
                </>
              ) : (
                <Button onClick={handleGmailLogin} variant="outline"
                  className="rounded-full glass bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.08] text-neutral-300 hover:text-white gap-2">
                  <Mail className="h-4 w-4" /> <span className="hidden lg:inline">Connect Gmail</span><span className="lg:hidden">Connect</span>
                </Button>
              )}
            </div>

            {/* Mobile menu */}
            <Button variant="ghost" size="icon" className="sm:hidden rounded-full glass h-9 w-9" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Menu">
              {mobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="sm:hidden border-t border-white/[0.06] overflow-hidden bg-black/30 backdrop-blur-xl"
            >
              <div className="px-4 py-3 flex flex-col gap-2">
                {isGmailConnected ? (
                  <>
                    <div className="flex items-center gap-2 text-xs font-semibold glass px-3 py-2 rounded-full w-fit">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Gmail Connected
                    </div>
                    <Button onClick={() => { handleSyncGmail(); setMobileMenu(false) }} disabled={isSyncing} className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 w-full">
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} {isSyncing ? 'Syncing…' : 'Sync Gmail'}
                    </Button>
                    <Button onClick={handleLogout} variant="ghost" size="sm"
                      className="rounded-xl glass bg-white/[0.06] hover:bg-red-500/10 border-white/[0.08] text-neutral-300 hover:text-red-400 gap-2 w-full">
                      <LogOut className="h-4 w-4" /> Logout
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleGmailLogin} variant="outline" className="rounded-xl glass w-full">
                    <Mail className="h-4 w-4" /> Connect Gmail
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6">
        {/* ── Hero + Stats ── */}
        <div className="grid grid-cols-12 gap-3 sm:gap-4">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.6 }}
            className="col-span-12 lg:col-span-7 glass-strong rounded-[20px] p-6 sm:p-8 relative overflow-hidden"
          >
            {/* Sapphire accent glow */}
            <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/10 blur-[80px]" />
            <div className="absolute -right-4 bottom-0 opacity-[0.04] hidden sm:block">
              <Layers className="w-40 h-40 text-blue-500" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-blue-400 mb-3">
                <Sparkles className="w-3.5 h-3.5" /> Stay Ahead
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight text-white">
                Your job search, <span className="bg-gradient-to-r from-blue-500 via-blue-400 to-blue-300 bg-clip-text text-transparent">beautifully organized.</span>
              </h2>
              <p className="text-sm text-neutral-400 mt-3 max-w-lg leading-relaxed">
                Add applications manually or sync from Gmail. Filter, update status, and keep momentum — all in a focused, glassy workspace.
              </p>
              <div className="flex items-center gap-4 mt-5">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-9 h-9 rounded-full border-2 border-neutral-800 glass flex items-center justify-center text-[11px] font-bold text-blue-400">
                      {['JD','AK','SR'][i-1]}
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <div className="font-bold text-white flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> {stats.total} total applications</div>
                  <div className="text-neutral-500 mt-0.5">{stats.interview} interviews • {stats.offer} offers</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats cards */}
          <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-2.5 sm:gap-3">
            {[
              { label: 'Total', value: stats.total, icon: Layers, glow: 'shadow-blue-500/10' },
              { label: 'Applied', value: stats.applied, icon: Clock3, glow: 'shadow-sky-500/10' },
              { label: 'Interview', value: stats.interview, icon: CheckCircle2, glow: 'shadow-emerald-500/10' },
              { label: 'Offer', value: stats.offer, icon: Sparkles, glow: 'shadow-blue-500/10' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12 + i * 0.06, duration: 0.5 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="glass-strong rounded-2xl p-4 relative overflow-hidden group cursor-default"
              >
                {/* Hover glow line */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center mb-3 group-hover:bg-blue-500/15 transition-colors duration-300">
                  <s.icon style={{ width: 18, height: 18 }} className="text-neutral-400 group-hover:text-blue-400 transition-colors duration-300" />
                </div>
                <div className="text-3xl sm:text-3xl font-bold tracking-tight text-white">{s.value}</div>
                <div className="text-[11px] font-semibold text-neutral-500 tracking-wide uppercase mt-0.5">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Add form ── */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="glass-strong rounded-[20px] p-5 sm:p-6 flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-white">Add Application</span>
            <span className="ml-auto text-xs text-neutral-500 hidden sm:inline">Press Enter to add</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative group">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-blue-400 transition-colors" />
              <Input placeholder="Company  •  e.g. Linear" value={company} onChange={e => setCompany(e.target.value)} required
                className="pl-10 h-11 rounded-xl glass-input text-sm text-white placeholder:text-neutral-500" />
            </div>
            <div className="flex-1 relative group">
              <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-blue-400 transition-colors" />
              <Input placeholder="Role  •  e.g. Product Designer" value={role} onChange={e => setRole(e.target.value)} required
                className="pl-10 h-11 rounded-xl glass-input text-sm text-white placeholder:text-neutral-500" />
            </div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="sm:shrink-0">
              <Button type="submit" className="h-11 px-6 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-xl shadow-blue-500/25 border-0 w-full sm:w-auto gap-2 relative overflow-hidden shimmer">
                <span className="relative z-10 flex items-center justify-center gap-2 font-semibold">Add Job <ArrowUpRight className="w-4 h-4" /></span>
              </Button>
            </motion.div>
          </div>
        </motion.form>

        {/* ── Search + Filter pills ── */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.26, duration: 0.5 }}
          className="flex flex-col gap-3"
        >
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 group-focus-within:text-blue-400 transition-colors" />
            <Input
              placeholder="Search by company or role…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-16 h-11 rounded-xl glass-input text-sm text-white placeholder:text-neutral-500"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-1 rounded-full bg-white/10 hover:bg-white/15 text-neutral-300 transition-colors">Clear</button>
            )}
          </div>
          <div className="flex items-center gap-1.5 glass rounded-xl p-1.5 overflow-x-auto no-scrollbar">
            <Filter className="w-3.5 h-3.5 text-neutral-500 ml-1 shrink-0" />
            {filterPills.map(pill => {
              const active = statusFilter === pill
              return (
                <button
                  key={pill}
                  onClick={() => setStatusFilter(pill)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                    active
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : 'text-neutral-500 hover:text-neutral-200 hover:bg-white/[0.06]'
                  }`}
                >
                  {pill}
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* Results meta */}
        <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
          <span className="flex items-center gap-1.5"><CircleDot className="w-3 h-3" /> Showing {filteredJobs.length} of {jobs.length}</span>
          <span className="hidden sm:flex items-center gap-1"><Calendar className="w-3 h-3" /> Updated just now</span>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="glass-strong rounded-[20px] p-12 sm:p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-neutral-400">Loading your applications…</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="hidden md:block glass-strong rounded-[20px] overflow-hidden"
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-white/[0.06] bg-white/[0.02] backdrop-blur">
                      <TableHead className="font-bold text-[10px] tracking-[0.15em] uppercase text-neutral-500">Company</TableHead>
                      <TableHead className="font-bold text-[10px] tracking-[0.15em] uppercase text-neutral-500">Role</TableHead>
                      <TableHead className="font-bold text-[10px] tracking-[0.15em] uppercase text-neutral-500">Status</TableHead>
                      <TableHead className="font-bold text-[10px] tracking-[0.15em] uppercase text-neutral-500 text-right">Date</TableHead>
                      <TableHead className="w-[48px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filteredJobs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-40 text-center">
                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3 py-4">
                              <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center">
                                <Search className="w-5 h-5 text-neutral-500" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-neutral-300">{searchTerm || statusFilter !== 'All' ? 'No matches found' : 'No jobs yet'}</p>
                                <p className="text-xs text-neutral-500 mt-1">{searchTerm || statusFilter !== 'All' ? 'Try a different search or filter' : 'Add your first application or sync from Gmail'}</p>
                              </div>
                            </motion.div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredJobs.map((job, idx) => {
                          const meta = getStatusMeta(job.status)
                          return (
                            <motion.tr
                              key={job.id}
                              layout
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{ delay: idx * 0.03, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                              className="group border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                            >
                              <TableCell className="font-bold max-w-[180px]">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md shadow-blue-500/20">
                                    {job.company.slice(0,2).toUpperCase()}
                                  </div>
                                  <span className="truncate text-white">{job.company}</span>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[320px] truncate text-sm text-neutral-400 group-hover:text-white transition-colors">
                                {job.role}
                              </TableCell>
                              <TableCell>
                                <Select value={job.status} onValueChange={(v) => handleStatusChange(job.id, v, job)}>
                                  <SelectTrigger className="w-[148px] h-8 rounded-full glass bg-white/[0.04] border-white/[0.06] text-xs font-semibold text-white">
                                    <span className="flex items-center gap-2">
                                      <span className={`w-2 h-2 rounded-full ${meta.dot} shadow-sm`} />
                                      <SelectValue />
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl bg-[#111] border-white/[0.08]">
                                    <SelectItem value="Applied" className="hover:bg-white/5 text-white">Applied</SelectItem>
                                    <SelectItem value="Interview" className="hover:bg-white/5 text-white">Interview</SelectItem>
                                    <SelectItem value="Offer" className="hover:bg-white/5 text-white">Offer</SelectItem>
                                    <SelectItem value="Rejected" className="hover:bg-white/5 text-white">Rejected</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full glass bg-white/[0.04] border-white/[0.06] text-neutral-400">
                                  <Calendar className="w-3 h-3" /> {job.date}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon"
                                  className="h-8 w-8 rounded-full text-neutral-600 hover:text-red-400 hover:bg-red-500/10 opacity-50 group-hover:opacity-100 transition-all"
                                  onClick={() => handleDelete(job.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </motion.tr>
                          )
                        })
                      )}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            </motion.div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredJobs.length === 0 ? (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-[20px] p-8 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center">
                      <Search className="w-5 h-5 text-neutral-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-300">{searchTerm || statusFilter !== 'All' ? 'No matches found' : 'No jobs yet'}</p>
                      <p className="text-xs text-neutral-500 mt-1">{searchTerm || statusFilter !== 'All' ? 'Try a different search or filter' : 'Add your first application or sync from Gmail'}</p>
                    </div>
                  </motion.div>
                ) : (
                  filteredJobs.map((job, idx) => {
                    const meta = getStatusMeta(job.status)
                    return (
                      <motion.div
                        key={job.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ delay: idx * 0.04, duration: 0.35 }}
                        className="glass-strong rounded-2xl p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md shadow-blue-500/20">
                              {job.company.slice(0,2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white text-sm truncate">{job.company}</div>
                              <div className="text-xs text-neutral-400 truncate">{job.role}</div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-neutral-600 hover:text-red-400 hover:bg-red-500/10 shrink-0 -mr-1" onClick={() => handleDelete(job.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <Select value={job.status} onValueChange={(v) => handleStatusChange(job.id, v, job)}>
                            <SelectTrigger className="flex-1 h-9 rounded-full glass bg-white/[0.04] border-white/[0.06] text-xs font-semibold text-white">
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                                <SelectValue />
                              </span>
                            </SelectTrigger>
                            <SelectContent className="rounded-xl bg-[#111] border-white/[0.08]">
                              <SelectItem value="Applied">Applied</SelectItem>
                              <SelectItem value="Interview">Interview</SelectItem>
                              <SelectItem value="Offer">Offer</SelectItem>
                              <SelectItem value="Rejected">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-2 rounded-full glass bg-white/[0.04] border-white/[0.06] text-neutral-400">
                            <Calendar className="w-3 h-3" /> {job.date}
                          </span>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        <p className="text-center text-xs text-neutral-600 pt-2 px-4">
          Crafted with glass, motion & obsession for detail • GSAP Style • v2.2
        </p>
      </main>
    </div>
  )
}

export default App
