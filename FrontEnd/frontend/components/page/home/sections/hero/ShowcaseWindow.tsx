"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/cn"
import { AnimatedIcon } from "@/components/ui/AnimatedIcon"
import { SHOWCASE_TABS } from "./hero.constants"

const AUTO_ROTATE_MS = 5000

export function ShowcaseWindow() {
  const [activeTab, setActiveTab] = useState(SHOWCASE_TABS[0].id)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (isPaused) return

    const interval = setInterval(() => {
      setActiveTab((prev) => {
        const currentIndex = SHOWCASE_TABS.findIndex((t) => t.id === prev)
        const nextIndex = (currentIndex + 1) % SHOWCASE_TABS.length
        return SHOWCASE_TABS[nextIndex].id
      })
    }, AUTO_ROTATE_MS)

    return () => clearInterval(interval)
  }, [isPaused])

  return (
    <div 
      className="relative w-full max-w-6xl mx-auto px-4 lg:px-0"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] backdrop-blur-xl">
        {/* MacOS Top Bar */}
        <div className="flex items-center gap-12 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex gap-2 min-w-[60px]">
            <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
            <div className="h-3 w-3 rounded-full bg-[#28C840]" />
          </div>
          
          {/* Scrollable Tab Bar */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {SHOWCASE_TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative px-4 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap",
                    isActive 
                      ? "bg-[#E53E3E] text-white shadow-[0_4px_12px_-2px_rgba(229,62,62,0.3)]" 
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {tab.label}
                  {isActive && !isPaused && (
                    <motion.div 
                      layoutId="tab-progress"
                      className="absolute bottom-0 left-0 h-[2px] bg-white/40"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: AUTO_ROTATE_MS / 1000, ease: "linear" }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Window Content */}
        <div className="relative min-h-[600px] md:h-[500px] bg-white overflow-hidden">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, scale: 0.98, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 1.02, y: -10 }}
               transition={{ duration: 0.4, ease: "easeOut" }}
               className="relative md:absolute md:inset-0 p-6 md:p-12 flex flex-col md:flex-row items-center gap-8 md:gap-12"
             >
                <div className="flex-1 space-y-4 md:space-y-6">
                   <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-[#E53E3E]/5 flex items-center justify-center border border-[#E53E3E]/10">
                      <AnimatedIcon name={getIconForTab(activeTab)} size={24} className="text-[#E53E3E]" />
                   </div>
                   <div>
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                         {SHOWCASE_TABS.find(t => t.id === activeTab)?.title}
                      </h3>
                      <p className="mt-2 md:mt-4 text-base md:text-lg text-slate-500 leading-relaxed max-w-md font-medium">
                         {SHOWCASE_TABS.find(t => t.id === activeTab)?.description}
                      </p>
                   </div>
                   <div className="pt-2 md:pt-4 flex items-center gap-6">
                      <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</span>
                         <span className="text-lg md:text-xl font-black text-slate-900">99.2%</span>
                      </div>
                      <div className="h-8 w-[1px] bg-slate-100" />
                      <div className="flex flex-col">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accuracy</span>
                         <span className="text-lg md:text-xl font-black text-[#E53E3E]">Gold Std.</span>
                      </div>
                   </div>
                </div>

                <div className="flex-1 w-full aspect-square md:h-full relative group">
                   {/* Dynamic UI Mockup Content */}
                   <TabContentMockup tabId={activeTab} />
                </div>
             </motion.div>
           </AnimatePresence>
        </div>
      </div>

      {/* Background decoration for the window */}
      <div className="absolute -z-10 -inset-4 bg-gradient-to-b from-[#E53E3E]/5 to-transparent blur-2xl opacity-50 rounded-[40px]" />
    </div>
  )
}

function getIconForTab(id: string) {
  switch(id) {
    case 'telehealth': return 'phone';
    case 'diagnostics': return 'eye';
    case 'optical': return 'glasses';
    case 'laboratory': return 'electricity';
    case 'insights': return 'electricity';
    default: return 'eye';
  }
}

function TabContentMockup({ tabId }: { tabId: string }) {
   const getImagePath = (id: string) => {
      switch(id) {
         case 'telehealth': return '/images/telehealth-view.png';
         case 'diagnostics': return '/images/medical-records.png';
         case 'optical': return '/images/marketplace-view.png';
         case 'laboratory': return '/images/prescription-view.png';
         case 'insights': return '/images/patient-dashboard.png';
         default: return null;
      }
   }

   const imagePath = getImagePath(tabId);

   if (imagePath) {
      return (
         <div className="w-full h-full rounded-2xl border border-slate-200 bg-[#f8fafc] relative overflow-hidden shadow-2xl flex flex-col group/browser">
            {/* Inner Browser Toolbar */}
            <div className="h-8 md:h-10 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2 shrink-0">
               <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
               </div>
               <div className="flex-1 max-w-[60%] mx-auto h-5 md:h-6 rounded-md bg-white border border-slate-200 flex items-center px-3 text-[10px] text-slate-400 font-medium truncate">
                  naderkeye.com/portal/{tabId}
               </div>
               <div className="flex gap-2">
                  <div className="h-4 w-4 rounded-md bg-slate-200" />
               </div>
            </div>
            
            {/* Browser Content Viewport */}
            <div className="flex-1 relative bg-white p-2 md:p-4 overflow-hidden">
               <Image 
                  src={imagePath}
                  alt={`${tabId} preview`}
                  fill 
                  sizes="(max-width: 768px) 100vw, 720px"
                  className="object-contain transition-transform duration-700 group-hover/browser:scale-[1.02]"
                  priority
               />
            </div>

            {/* Ambient Depth Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
         </div>
      )
   }

   return (
      <div className="w-full h-full rounded-2xl border border-slate-100 bg-slate-50/50 p-6 relative overflow-hidden shadow-inner">
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] pointer-events-none" />
         
         {/* Fallback Mockup */}
         <div className="h-full flex flex-col gap-4 opacity-20">
            <div className="h-6 w-1/3 rounded bg-slate-200/50" />
            <div className="grid grid-cols-2 gap-4 flex-1">
               <div className="rounded-xl bg-white border border-slate-100 p-4" />
               <div className="rounded-xl bg-white border border-slate-100 p-4" />
            </div>
         </div>
      </div>
   )
}
