"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTelehealthSessionDetail } from '@/services/telehealth/telehealth.hooks';
import TelehealthStatusBadge from '@/components/telehealth/TelehealthStatusBadge';
import { Loader2, Video, Camera, Mic, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

interface SharedTelehealthDetailContainerProps {
  sessionId: string;
}

export function SharedTelehealthDetailContainer({ sessionId }: SharedTelehealthDetailContainerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: session, isLoading, error } = useTelehealthSessionDetail(sessionId);
  
  const isDoctor = user?.role === 'DOCTOR';
  const isAgent = user?.role === 'MEDICAL_AGENT' || user?.role === 'AGENT';
  const basePath = isDoctor
    ? '/doctor/telehealth'
    : isAgent
      ? '/agent/telehealth'
      : '/dashboard/telehealth';
  const messagesPath = isDoctor
    ? '/doctor/messages'
    : isAgent
      ? '/agent/chats'
      : '/dashboard/messages';

  // Device Check State
  const [checkingDevices, setCheckingDevices] = useState(true);
  const [camStatus, setCamStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [micStatus, setMicStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Only check if session is active/upcoming
    if (session && ['SCHEDULED', 'READY', 'WAITING', 'IN_PROGRESS'].includes(session.status)) {
      startDeviceCheck();
    } else {
      setCheckingDevices(false);
    }

    return () => {
      // Clean up stream on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [session]);

  const startDeviceCheck = async () => {
    setCheckingDevices(true);
    setErrorMessage(null);
    setCamStatus('pending');
    setMicStatus('pending');

    try {
      // Request both audio and video
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      
      setCamStatus('success');
      setMicStatus('success');
      setCheckingDevices(false);

      // Render local preview stream
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Device permission error:", err);
      setCheckingDevices(false);
      
      // Determine what failed
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCamStatus('failed');
        setMicStatus('failed');
        setErrorMessage("Permissions Denied: Please allow access to your camera and microphone in browser settings.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage("No devices found: Please ensure you have a working camera and microphone connected.");
      } else {
        setErrorMessage(`Device Error: ${err.message || "Unable to acquire media stream"}`);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-gray-50/20 rounded-3xl min-h-[450px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#E03E3E] mb-4" />
        <p className="text-gray-500 text-sm">Retrieving session details...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto mb-4 border border-red-100/35">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Session not found</h3>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          The requested telehealth session does not exist or you do not have permission to view it.
        </p>
        <Link
          href={basePath}
          className="px-5 py-2.5 bg-[#E03E3E] text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Consultations
        </Link>
      </div>
    );
  }

  const isPast = ['COMPLETED', 'CANCELLED', 'PATIENT_NO_SHOW', 'DOCTOR_NO_SHOW', 'MISSED'].includes(session.status);
  const devicesReady = camStatus === 'success' && micStatus === 'success';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <Link href={basePath} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 font-bold transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to consultations
      </Link>

      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-5 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                {session.service_name}
              </h1>
              <TelehealthStatusBadge status={session.status} />
            </div>
            <p className="text-xs text-gray-400 font-semibold">
              Session ID: <code className="text-[10px] bg-gray-50 px-1.5 py-0.5 rounded text-gray-600">{session.id}</code>
            </p>
          </div>
          
          {!isPast && (
            <div className="flex items-center gap-3">
              <button 
                onClick={startDeviceCheck}
                className="text-xs border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Recheck Devices
              </button>
            </div>
          )}
        </div>

        {isPast ? (
          <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900 mb-1">Session Closed</h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
              This consultation has completed, expired, or been cancelled. You can no longer join the video room.
            </p>
            {session.conversation_id && (
              <Link
                href={`${messagesPath}?conversation_id=${session.conversation_id}`}
                className="px-5 py-2.5 bg-[#E03E3E] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5"
              >
                Go to Care Team Messages
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Video Preview Check */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Hardware Device Preview
              </h3>
              
              <div className="aspect-video bg-gray-950 rounded-2xl overflow-hidden relative border border-gray-800 flex items-center justify-center">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                {checkingDevices && (
                  <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center text-white text-xs font-semibold gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Acquiring camera stream...
                  </div>
                )}
                
                {!checkingDevices && !devicesReady && (
                  <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center text-center p-4">
                    <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                    <p className="text-xs text-white font-semibold max-w-xs leading-normal">
                      {errorMessage || "Media permission check failed."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Checklist & Enter Button */}
            <div className="flex flex-col justify-between">
              <div className="space-y-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Device Readiness Verification
                </h3>

                <div className="space-y-3">
                  {/* Camera Check */}
                  <div className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <Camera className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs font-bold text-gray-900">Webcam Access</p>
                        <p className="text-[10px] text-gray-400 font-semibold">Requires camera feed permission</p>
                      </div>
                    </div>
                    {camStatus === 'success' ? (
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded">Granted</span>
                    ) : camStatus === 'failed' ? (
                      <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-1 rounded">Denied</span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded">Checking</span>
                    )}
                  </div>

                  {/* Mic Check */}
                  <div className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs font-bold text-gray-900">Microphone Access</p>
                        <p className="text-[10px] text-gray-400 font-semibold">Requires audio capture permission</p>
                      </div>
                    </div>
                    {micStatus === 'success' ? (
                      <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded">Granted</span>
                    ) : micStatus === 'failed' ? (
                      <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-1 rounded">Denied</span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded">Checking</span>
                    )}
                  </div>
                </div>

                {!devicesReady && !checkingDevices && (
                  <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 leading-normal font-semibold">
                    <strong>To join the consultation:</strong> Click the lock icon in your browser address bar and change permissions for this page to "Allow" for Camera and Microphone, then click <strong>Recheck Devices</strong>.
                  </div>
                )}
              </div>

              <div className="pt-6">
                <button
                  disabled={!devicesReady}
                  onClick={() => router.push(`${basePath}/${session.id}/waiting-room`)}
                  className="w-full py-3 bg-[#E03E3E] hover:bg-red-750 disabled:bg-gray-100 text-white disabled:text-gray-400 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Enter Waiting Room
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SharedTelehealthDetailContainer;
