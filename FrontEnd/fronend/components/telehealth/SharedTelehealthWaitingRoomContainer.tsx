"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealthSessionDetail, useJoinTelehealthSession } from '@/services/telehealth/telehealth.hooks';
import { 
  Loader2, Video, AlertCircle, Mic, MicOff, 
  Camera, CameraOff, ArrowLeft, MessageSquare, LayoutGrid, PhoneOff, Monitor
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import TelehealthChat from '@/components/telehealth/TelehealthChat';

interface SharedTelehealthWaitingRoomContainerProps {
  sessionId: string;
}

export function SharedTelehealthWaitingRoomContainer({ sessionId }: SharedTelehealthWaitingRoomContainerProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  const { data: session, isLoading, error, refetch } = useTelehealthSessionDetail(sessionId);
  const { mutateAsync: joinSession, isPending: joining } = useJoinTelehealthSession();
  
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [joinedRoom, setJoinedRoom] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isDoctor = user?.role === 'DOCTOR';
  const isAgent = user?.role === 'MEDICAL_AGENT' || user?.role === 'AGENT';
  const basePath = isDoctor
    ? '/doctor/telehealth'
    : isAgent
      ? '/agent/telehealth'
      : '/dashboard/telehealth';

  // 1. Auto join for patient upon mount (once, when session first loads)
  const hasTriedJoinRef = useRef(false);
  useEffect(() => {
    if (session && !isDoctor && !joinedRoom && !joining && !hasTriedJoinRef.current) {
      hasTriedJoinRef.current = true;
      handlePatientJoinWaiting();
    }
  }, [session, isDoctor]);

  // 2. Local camera preview setup
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        if (videoEnabled) {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: audioEnabled 
          });
          activeStream = stream;
          setLocalStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } else {
          if (audioEnabled) {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              video: false, 
              audio: true 
            });
            activeStream = stream;
            setLocalStream(stream);
          } else {
            setLocalStream(null);
          }
        }
      } catch (err) {
        console.error("Waiting room local camera preview error:", err);
      }
    };

    if (joinedRoom || isDoctor) {
      startCamera();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoEnabled, joinedRoom, isDoctor]);

  // 3. Keep audio tracks synced with state
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = audioEnabled;
      });
    }
  }, [audioEnabled, localStream]);

  // 4. Patient Waiting Room Polling (Check for Doctor Join)
  useEffect(() => {
    if (session && !isDoctor && joinedRoom) {
      // Redirect to session room when both parties are connected
      if (session.status === 'ACTIVE') {
        router.push(`${basePath}/${sessionId}/session?audio=${audioEnabled}&video=${videoEnabled}`);
        return;
      }

      // Check for missed/cancelled session
      if (session.status === 'MISSED' || session.status === 'CANCELLED') {
        toast.error("This session has ended or was not started in time.");
        router.push(isDoctor ? `/doctor/telehealth` : `/dashboard/telehealth`);
        return;
      }

      // Poll every 5 seconds
      const interval = setInterval(() => {
        refetch();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [session, isDoctor, joinedRoom, sessionId, router, refetch, audioEnabled, videoEnabled, basePath]);

  // 5. Doctor manual join/start
  const handleStartConsultation = async () => {
    try {
      await joinSession(sessionId);
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
      }
      router.push(`${basePath}/${sessionId}/session?audio=${audioEnabled}&video=${videoEnabled}`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to enter consultation.");
    }
  };

  const handlePatientJoinWaiting = async () => {
    try {
      await joinSession(sessionId);
      setJoinedRoom(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to join waiting room.");
    }
  };

  const handleLeaveWaitingRoom = () => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    router.push(`${basePath}/${sessionId}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-screen bg-[#f8f9fc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#E03E3E] mb-4" />
        <p className="text-gray-500 text-sm font-semibold">Initializing waiting room...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-20 max-w-md mx-auto min-h-screen flex flex-col justify-center bg-[#f8f9fc]">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto mb-4 border border-red-100/35">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Session not found</h3>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          The requested telehealth session does not exist or you do not have permission to join.
        </p>
        <Link href={basePath} className="px-4 py-2 bg-[#E03E3E] text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Back to Workspace
        </Link>
      </div>
    );
  }

  const doctorName = session.doctor?.display_name || `Dr. ${session.doctor?.last_name || 'Clinician'}`;
  const patientName = session.patient?.display_name || "Patient";
  const targetConversationId = session.conversation_id;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col overflow-hidden bg-[#f8f9fc] select-none">
      {/* Breadcrumbs Row */}
      <div className="flex items-center gap-2 text-xs text-gray-500 font-bold px-6 py-4 bg-[#f8f9fc] shrink-0">
        <LayoutGrid className="w-4 h-4 text-gray-400" />
        <span>/</span>
        <span className="hover:text-gray-900 transition-colors">Messages</span>
        <span>/</span>
        <span className="text-[#E03E3E]">Video Conferencing</span>
      </div>

      <div className="flex-1 p-6 pt-2 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-hidden bg-[#f8f9fc]">
        {/* Left Card: Waiting Area Video & Preview */}
        <div className="md:col-span-8 lg:col-span-9 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full relative">
          
          <div className="flex-grow flex flex-col relative overflow-hidden bg-white">
            {/* Center Content */}
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 bg-white relative">
              {isDoctor ? (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-[#E03E3E]/5 flex items-center justify-center mb-6">
                    <Video className="w-7 h-7 text-[#E03E3E]" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
                    Start Consultation
                  </h2>
                  <p className="text-sm text-gray-400 leading-normal max-w-sm mx-auto mb-6 font-semibold">
                    You are assigned to consult with {patientName}. Click below to activate the video room.
                  </p>
                  <button
                    disabled={joining}
                    onClick={handleStartConsultation}
                    className="px-6 py-3.5 bg-[#E03E3E] hover:bg-red-750 disabled:bg-gray-100 text-white disabled:text-gray-400 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                    Start Video Call
                  </button>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-[#E03E3E]/5 flex items-center justify-center mb-6">
                    <Video className="w-7 h-7 text-[#E03E3E]" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
                    Waiting for {doctorName}
                  </h2>
                  <p className="text-sm text-gray-400 leading-normal max-w-sm mx-auto font-semibold">
                    The doctor will join in shortly. Please stay on the line.
                  </p>
                  <div className="mt-4">
                    <span className="bg-red-50 text-[#E03E3E] font-bold text-[10px] tracking-wider uppercase px-4 py-1.5 rounded-full border border-red-100/50 animate-pulse">
                      Connection Secured
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Local Video Stream PIP */}
            {videoEnabled && (joinedRoom || isDoctor) && (
              <div className="absolute bottom-6 right-6 w-40 md:w-56 aspect-video rounded-2xl overflow-hidden shadow-lg border border-gray-100 bg-black z-10">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute bottom-2 left-3 bg-black/40 backdrop-blur-sm text-[10px] text-white px-2 py-0.5 rounded font-semibold">
                  You (Self View)
                </div>
              </div>
            )}
          </div>

          {/* Bottom Toolbar Controls */}
          <div className="h-24 border-t border-gray-100 flex items-center justify-center gap-10 bg-white shrink-0 z-20">
            {/* MUTE button */}
            <button onClick={() => setAudioEnabled(!audioEnabled)} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${
                audioEnabled ? 'border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100' : 'border-red-100 text-red-500 bg-red-50 hover:bg-red-100'
              }`}>
                {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Mute</span>
            </button>

            {/* VIDEO button */}
            <button onClick={() => setVideoEnabled(!videoEnabled)} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${
                videoEnabled ? 'border-gray-200 text-gray-500 bg-gray-50 hover:bg-gray-100' : 'border-red-100 text-red-500 bg-red-50 hover:bg-red-100'
              }`}>
                {videoEnabled ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Video</span>
            </button>

            {/* SHARE button (Disabled in waiting room) */}
            <button disabled className="flex flex-col items-center gap-1 opacity-50 cursor-not-allowed" title="Unavailable in waiting room">
              <div className="w-12 h-12 rounded-full border border-gray-200 text-gray-300 bg-gray-50 flex items-center justify-center">
                <Monitor className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wide">Share</span>
            </button>

            {/* LEAVE button */}
            <button onClick={handleLeaveWaitingRoom} className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-655 text-white flex items-center justify-center transition-all shadow hover:shadow-md">
                <PhoneOff className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Leave</span>
            </button>
          </div>
        </div>

        {/* Right Card: Care Team Chat Column */}
        {targetConversationId ? (
          <div className="md:col-span-4 lg:col-span-3 h-full overflow-hidden flex flex-col bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#E03E3E]" /> Chat
              </h2>
            </div>
            <div className="w-full border-b border-gray-100"></div>
            
            <div className="flex-grow overflow-hidden flex flex-col">
              <TelehealthChat conversationId={targetConversationId} />
            </div>
          </div>
        ) : (
          <div className="md:col-span-4 lg:col-span-3 h-full flex flex-col items-center justify-center bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#E03E3E] mb-2" />
            <p className="text-xs text-gray-400">Initializing secure chat...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default SharedTelehealthWaitingRoomContainer;
