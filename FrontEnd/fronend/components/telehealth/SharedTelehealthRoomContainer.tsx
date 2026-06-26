"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  useTelehealthSessionDetail, 
  useJoinTelehealthSession, 
  useEndTelehealthSession 
} from '@/services/telehealth/telehealth.hooks';
import { useSubmitPrescription } from '@/services/marketplace/marketplace.hooks';
import { useCreateMedication } from '@/services/medical-records/records.hooks';
import { DatePicker } from '@/components/ui/DatePicker';
import { useAuth } from '@/hooks/useAuth';
import TelehealthChat from './TelehealthChat';
import TelehealthStatusBadge from './TelehealthStatusBadge';
import { 
  LiveKitRoom, 
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useConnectionState,
  useRoomContext
} from '@livekit/components-react';
import { ConnectionState, Track } from 'livekit-client';
import { 
  Loader2, AlertCircle, PhoneOff, Mic, MicOff, Camera, CameraOff, 
  Monitor, MessageSquare, ArrowLeft, Video, LayoutGrid, CheckCircle2,
  FileText, Clipboard, HeartPulse, Pill, CalendarPlus, FileCheck, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Link from 'next/link';

interface SharedTelehealthRoomContainerProps {
  sessionId: string;
}

export function SharedTelehealthRoomContainer({ sessionId }: SharedTelehealthRoomContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // `loading` tracks the in-flight token fetch. Using a local state (not the
  // mutation's isPending) avoids the React Strict Mode double-mutation bug where
  // two simultaneous calls leave isPending permanently true after the first resolves.
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<{ room_name: string; token: string; server_url: string } | null>(null);
  const [showPostWorkflow, setShowPostWorkflow] = useState(false);

  const audioEnabled = searchParams.get('audio') !== 'false';
  const videoEnabled = searchParams.get('video') !== 'false';

  const { data: session, isLoading, error } = useTelehealthSessionDetail(sessionId);
  const { mutateAsync: fetchToken } = useJoinTelehealthSession();

  const isDoctor = user?.role === 'DOCTOR';

  useEffect(() => {
    // `active` cancels the stale result from React Strict Mode's first invocation.
    // Strict Mode: first run starts M1 → cleanup sets active=false → second run starts
    // M2 → M1 resolves but is ignored → M2 resolves and sets credentials cleanly.
    let active = true;
    const initSession = async () => {
      try {
        const creds = await fetchToken(sessionId);
        if (active) {
          setCredentials(creds);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          console.error("Token error:", err);
          toast.error(err.response?.data?.message || "Failed to acquire session token.");
          setLoading(false);
        }
      }
    };
    initSession();
    return () => { active = false; };
  }, [sessionId]);

  if (loading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[500px] bg-gray-50/20">
        <Loader2 className="w-8 h-8 animate-spin text-[#E03E3E] mb-4" />
        <p className="text-gray-500 text-sm font-semibold">Connecting to secure telehealth server...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-20 max-w-md mx-auto flex flex-col justify-center min-h-[400px]">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto mb-4 border border-red-100/35">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Session not found</h3>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          The telehealth session is invalid or you do not have permission to access this consultation.
        </p>
        <button
          onClick={() => router.push(isDoctor ? '/doctor/telehealth' : '/dashboard/telehealth')}
          className="px-4 py-2.5 bg-[#E03E3E] text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 mx-auto"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Consultations
        </button>
      </div>
    );
  }

  // Handle post-consultation workflow display
  const isPast = ['COMPLETED', 'CANCELLED', 'PATIENT_NO_SHOW', 'DOCTOR_NO_SHOW', 'MISSED'].includes(session.status);

  if ((isPast || showPostWorkflow) && isDoctor) {
    return <PostConsultationWorkflow session={session} sessionId={sessionId} />;
  }

  if (isPast && !isDoctor) {
    return (
      <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-sm max-w-xl mx-auto my-10">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">Consultation Completed</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6 leading-relaxed">
          Your telehealth consultation has ended. Your provider is wrapping up the medical records and prescription files.
        </p>
        {session.conversation_id && (
          <Link
            href={`/dashboard/messages?conversation_id=${session.conversation_id}`}
            className="px-6 py-3 bg-[#E03E3E] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5"
          >
            Go to Care Team Messages
          </Link>
        )}
      </div>
    );
  }

  if (!credentials) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[500px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#E03E3E] mb-4" />
        <p className="text-gray-500 text-sm font-semibold">Acquiring video stream credentials...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-160px)] flex flex-col overflow-hidden bg-white rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
      <LiveKitRoom
        token={credentials.token}
        serverUrl={credentials.server_url}
        connect={true}
        audio={audioEnabled}
        video={videoEnabled}
        className="flex-grow flex flex-col h-full overflow-hidden"
      >
        <RoomWorkspace 
          session={session} 
          user={user} 
          onEndSessionTrigger={() => setShowPostWorkflow(true)} 
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}

// Inner LiveKit Workspace
function RoomWorkspace({ 
  session, 
  user, 
  onEndSessionTrigger 
}: { 
  session: any; 
  user: any; 
  onEndSessionTrigger: () => void 
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutateAsync: endSessionCall } = useEndTelehealthSession();
  
  const connectionState = useConnectionState();
  const room = useRoomContext();
  
  const [micOn, setMicOn] = useState(searchParams.get('audio') !== 'false');
  const [camOn, setCamOn] = useState(searchParams.get('video') !== 'false');
  const [screenShareOn, setScreenShareOn] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  
  const isDoctor = user?.role === 'DOCTOR';
  const targetConversationId = session.conversation_id;

  const handleToggleMic = () => {
    const nextState = !micOn;
    setMicOn(nextState);
    room.localParticipant.setMicrophoneEnabled(nextState);
  };

  const handleToggleCam = () => {
    const nextState = !camOn;
    setCamOn(nextState);
    room.localParticipant.setCameraEnabled(nextState);
  };

  const handleToggleScreenShare = async () => {
    try {
      const nextState = !screenShareOn;
      setScreenShareOn(nextState);
      await room.localParticipant.setScreenShareEnabled(nextState);
    } catch (err) {
      setScreenShareOn(false);
      toast.error("Screen sharing cancelled or unsupported.");
    }
  };

  const handleLeaveSession = async () => {
    // Stop and unpublish all local media tracks before disconnecting
    try {
      const localParticipant = room.localParticipant;
      await localParticipant.setCameraEnabled(false);
      await localParticipant.setMicrophoneEnabled(false);
      await localParticipant.setScreenShareEnabled(false);
    } catch (err) {
      console.error("Error stopping tracks:", err);
    }
    room.disconnect();
    if (isDoctor) {
      try {
        await endSessionCall({ sessionId: session.id });
        toast.success("Consultation session terminated.");
        onEndSessionTrigger();
      } catch (err) {
        console.error(err);
      }
    } else {
      router.push(`/dashboard/telehealth/${session.id}/completed`);
    }
  };

  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const remoteVideoTracks = tracks.filter(t => !t.participant.isLocal && t.source === Track.Source.Camera);
  const remoteScreenShareTracks = tracks.filter(t => !t.participant.isLocal && t.source === Track.Source.ScreenShare);
  const localVideoTrack = tracks.find(t => t.participant.isLocal && t.source === Track.Source.Camera);

  const isReconnecting = connectionState === ConnectionState.Reconnecting;
  const doctorName = session.doctor?.display_name || `Dr. ${session.doctor?.last_name || 'Clinician'}`;
  const patientName = session.patient?.display_name || "Patient";

  return (
    <div className="flex-grow grid grid-cols-1 md:grid-cols-12 gap-0 items-stretch h-full overflow-hidden">
      
      {/* Left Column: Video Workspace Grid */}
      <div className={`flex flex-col h-full bg-black relative ${chatOpen ? 'md:col-span-8 lg:col-span-9' : 'md:col-span-12'}`}>
        
        {/* Connection status indicators */}
        {isReconnecting && (
          <div className="absolute inset-0 z-50 bg-black/85 flex flex-col items-center justify-center text-center p-4">
            <Loader2 className="w-12 h-12 animate-spin text-[#E03E3E] mb-4" />
            <h2 className="text-lg font-bold text-white mb-1">Reconnecting...</h2>
            <p className="text-xs text-gray-400 max-w-xs leading-normal">
              Network dropped. Attempting to restore consultation video feed. Stay on the line.
            </p>
          </div>
        )}

        {/* Video stream canvas rendering */}
        <div className="flex-grow flex flex-col relative overflow-hidden bg-gray-950/40">
          {remoteScreenShareTracks.length > 0 ? (
            <div className="w-full h-full bg-black flex items-center justify-center p-3">
              <VideoTrack trackRef={remoteScreenShareTracks[0]} className="w-full h-full object-contain rounded-2xl" />
            </div>
          ) : remoteVideoTracks.length > 0 ? (
            <div className="w-full h-full bg-black relative flex items-center justify-center p-3">
              <VideoTrack trackRef={remoteVideoTracks[0]} className="w-full h-full object-cover scale-x-[-1] rounded-2xl" />
              <div className="absolute bottom-6 left-6 bg-black/60 backdrop-blur-md text-white text-[11px] px-3 py-1.5 rounded-full font-bold border border-white/10 shadow-lg">
                {isDoctor ? patientName : doctorName}
              </div>
            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-8 bg-gray-950 text-white relative">
              <div className="w-16 h-16 rounded-2xl bg-[#E03E3E]/10 flex items-center justify-center mb-5 border border-red-500/20">
                <Video className="w-8 h-8 text-[#E03E3E]" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-1">
                Waiting for {isDoctor ? patientName : doctorName}
              </h2>
              <p className="text-xs text-gray-500 leading-normal max-w-xs mx-auto">
                Secure audio & video tunnel active. Live feed will connect when the other party enters the room.
              </p>
              <div className="mt-5">
                <span className="bg-red-950/30 text-[#E03E3E] font-bold text-[10px] tracking-wider uppercase px-4 py-1.5 rounded-full border border-[#E03E3E]/30 animate-pulse">
                  Clinician Waiting Room Active
                </span>
              </div>
            </div>
          )}

          {/* Local Participant PIP */}
          {localVideoTrack && (
            <div className="absolute bottom-6 right-6 w-36 md:w-52 aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-black z-10">
              <VideoTrack trackRef={localVideoTrack} className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute bottom-2 left-2.5 bg-black/55 backdrop-blur-sm text-[9px] text-white px-2 py-0.5 rounded font-bold">
                You
              </div>
            </div>
          )}
        </div>

        {/* Control toolbar actions */}
        <div className="h-24 border-t border-white/5 flex items-center justify-center gap-8 bg-gray-900 shrink-0">
          <button onClick={handleToggleMic} className="flex flex-col items-center gap-1 cursor-pointer">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              micOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white hover:bg-red-600'
            }`}>
              {micOn ? <Mic className="w-4.5 h-4.5" /> : <MicOff className="w-4.5 h-4.5" />}
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Mute</span>
          </button>

          <button onClick={handleToggleCam} className="flex flex-col items-center gap-1 cursor-pointer">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              camOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-red-500 text-white hover:bg-red-600'
            }`}>
              {camOn ? <Camera className="w-4.5 h-4.5" /> : <CameraOff className="w-4.5 h-4.5" />}
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Camera</span>
          </button>

          <button onClick={handleToggleScreenShare} className="flex flex-col items-center gap-1 cursor-pointer">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              screenShareOn ? 'bg-[#E03E3E] text-white hover:bg-red-600' : 'bg-white/10 text-white hover:bg-white/20'
            }`}>
              <Monitor className="w-4.5 h-4.5" />
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Share</span>
          </button>

          <button onClick={handleLeaveSession} className="flex flex-col items-center gap-1 cursor-pointer">
            <div className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg hover:shadow-red-600/20">
              <PhoneOff className="w-4.5 h-4.5" />
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">End Session</span>
          </button>
        </div>
      </div>

      {/* Right Column: Chat panel */}
      {chatOpen && targetConversationId && (
        <div className="md:col-span-4 lg:col-span-3 h-full overflow-hidden flex flex-col bg-white border-l border-gray-100">
          <div className="px-5 py-4 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#E03E3E]" /> Chat Workspace
            </h2>
          </div>
          <div className="w-full border-b border-gray-100"></div>
          
          <div className="flex-grow overflow-hidden flex flex-col">
            <TelehealthChat conversationId={targetConversationId} />
          </div>
        </div>
      )}
    </div>
  );
}

// Doctor Post Consultation Clinical Workflow Screen
function PostConsultationWorkflow({ 
  session, 
  sessionId 
}: { 
  session: any; 
  sessionId: string 
}) {
  const router = useRouter();
  const endSessionCall = useEndTelehealthSession();
  const submitPrescription = useSubmitPrescription();

  // Consultation Encounter states
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [submittingEncounter, setSubmittingEncounter] = useState(false);

  // Medication prescription states
  const createMedication = useCreateMedication();
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFrequency, setMedFrequency] = useState('');
  const [medStartDate, setMedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [medEndDate, setMedEndDate] = useState('');
  const [issuedMeds, setIssuedMeds] = useState<string[]>([]);

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim() || !medDosage.trim() || !medFrequency.trim()) {
      toast.error("Medication name, dosage and instructions are required.");
      return;
    }
    try {
      await createMedication.mutateAsync({
        patient_id: session.patient.id,
        name: medName,
        dosage: medDosage,
        frequency: medFrequency,
        start_date: medStartDate,
        end_date: medEndDate || null,
      });
      setIssuedMeds(prev => [...prev, medName]);
      setMedName(''); setMedDosage(''); setMedFrequency(''); setMedEndDate('');
      toast.success(`${medName} added to prescription.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add medication.");
    }
  };

  // Prescription Builder states
  const [odSph, setOdSph] = useState('');
  const [odCyl, setOdCyl] = useState('');
  const [odAxis, setOdAxis] = useState('');
  const [odAdd, setOdAdd] = useState('');
  const [osSph, setOsSph] = useState('');
  const [osCyl, setOsCyl] = useState('');
  const [osAxis, setOsAxis] = useState('');
  const [osAdd, setOsAdd] = useState('');
  const [pd, setPd] = useState('62');
  const [submittingPrescription, setSubmittingPrescription] = useState(false);

  const handleSaveEncounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.error("Clinical notes are required to file the consultation record.");
      return;
    }
    setSubmittingEncounter(true);
    try {
      await endSessionCall.mutateAsync({
        sessionId,
        session_notes: notes,
        diagnosis,
        recommendations,
        follow_up_date: followUpDate || undefined
      });
      toast.success("Consultation encounter notes logged successfully.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save clinical notes.");
    } finally {
      setSubmittingEncounter(false);
    }
  };

  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    const pdNum = parseFloat(pd);
    if (isNaN(pdNum) || pdNum < 40 || pdNum > 80) {
      toast.error("Please provide a valid Pupillary Distance (between 40 and 80 mm).");
      return;
    }
    setSubmittingPrescription(true);
    try {
      await submitPrescription.mutateAsync({
        patient_id: session.patient.id,
        pupillary_distance: pdNum,
        right_sph: odSph ? parseFloat(odSph) : null,
        right_cyl: odCyl ? parseFloat(odCyl) : null,
        right_axis: odAxis ? parseInt(odAxis) : null,
        right_add: odAdd ? parseFloat(odAdd) : null,
        left_sph: osSph ? parseFloat(osSph) : null,
        left_cyl: osCyl ? parseFloat(osCyl) : null,
        left_axis: osAxis ? parseInt(osAxis) : null,
        left_add: osAdd ? parseFloat(osAdd) : null,
      });
      toast.success("Eye prescription generated and approved successfully!");
      // Clear fields
      setOdSph(''); setOdCyl(''); setOdAxis(''); setOdAdd('');
      setOsSph(''); setOsCyl(''); setOsAxis(''); setOsAdd('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to issue prescription. Check validation limits.");
    } finally {
      setSubmittingPrescription(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50/30">
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* Header summary */}
        <Card className="p-6 bg-white border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">Post-Consultation clinical workflow</h1>
                <TelehealthStatusBadge status="COMPLETED" />
              </div>
              <p className="text-xs text-gray-400 font-semibold mt-1">
                Patient: {session.patient.display_name} • Session: <code className="bg-gray-50 text-[10px] px-1 rounded">{session.id.slice(0, 8)}</code>
              </p>
            </div>
          </div>
          <Button 
            id="btn_back_consultations"
            variant="outline" 
            onClick={() => router.push('/doctor/telehealth')}
            className="text-xs h-10 px-5 rounded-xl font-bold border-gray-200 hover:bg-gray-50 cursor-pointer shadow-none shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Workspace
          </Button>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Left Panel: Encounter notes builder */}
          <Card className="p-6 bg-white border border-gray-100 space-y-5 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
              <Clipboard className="w-5 h-5 text-[#E03E3E]" />
              <h2 className="font-bold text-gray-900 text-sm">Consultation Encounter Form</h2>
            </div>

            <form onSubmit={handleSaveEncounter} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Clinical Notes (Required)</label>
                <textarea 
                  id="clinical_notes_area"
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record symptoms, observations, or exam results..." 
                  className="w-full h-32 bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-[#E03E3E] font-semibold text-gray-700 resize-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Diagnosis (Optional)</label>
                <textarea 
                  id="diagnosis_area"
                  value={diagnosis} 
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Clinical assessment or diagnosed conditions (e.g. Myopia, Astigmatism)..." 
                  className="w-full h-20 bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-[#E03E3E] font-semibold text-gray-700 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Recommendations (Optional)</label>
                <textarea 
                  id="recommendations_area"
                  value={recommendations} 
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="Usage instructions, treatment plan, exercise details..." 
                  className="w-full h-20 bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-[#E03E3E] font-semibold text-gray-700 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Schedule Follow-up Date (Optional)</label>
                <input 
                  id="followup_date_input"
                  type="date" 
                  value={followUpDate} 
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-[#E03E3E] font-semibold text-gray-700"
                />
              </div>

              <Button 
                id="btn_submit_encounter"
                type="submit" 
                isLoading={submittingEncounter}
                className="w-full bg-[#E03E3E] hover:bg-red-700 text-white font-bold h-11 rounded-xl text-xs transition-colors"
              >
                <FileCheck className="w-4 h-4 mr-1.5" /> Save Consultation Encounter
              </Button>
            </form>
          </Card>

          {/* Right Panel: Medication Prescription + Optics Builder */}
          <div className="space-y-5">

          {/* Medication Prescription */}
          <Card className="p-6 bg-white border border-gray-100 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-[#E03E3E]" />
                <h2 className="font-bold text-gray-900 text-sm">Issue Medication Prescription</h2>
              </div>
              {issuedMeds.length > 0 && (
                <button
                  type="button"
                  onClick={() => router.push(`/doctor/prescriptions?patient=${session.patient.id}`)}
                  className="text-[10px] font-bold text-[#E03E3E] hover:underline"
                >
                  View Full Rx →
                </button>
              )}
            </div>

            {issuedMeds.length > 0 && (
              <div className="space-y-1 pb-3 border-b border-gray-50">
                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Added this session</p>
                {issuedMeds.map((m, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {m}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddMedication} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Medication Name</label>
                <input value={medName} onChange={e => setMedName(e.target.value)} placeholder="e.g. Amoxicillin Capsules"
                  className="w-full bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-lg p-2.5 text-xs font-semibold text-gray-700 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Dosage</label>
                <input value={medDosage} onChange={e => setMedDosage(e.target.value)} placeholder="e.g. 500mg TID × 7 days"
                  className="w-full bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-lg p-2.5 text-xs font-semibold text-gray-700 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Instructions (SIG)</label>
                <input value={medFrequency} onChange={e => setMedFrequency(e.target.value)} placeholder="e.g. Take one capsule orally three times daily after meals"
                  className="w-full bg-gray-50/50 border border-gray-200 focus:border-[#E03E3E] rounded-lg p-2.5 text-xs font-semibold text-gray-700 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Start Date</label>
                  <DatePicker value={medStartDate} onChange={setMedStartDate} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">End Date</label>
                  <DatePicker value={medEndDate} onChange={setMedEndDate} min={medStartDate} />
                </div>
              </div>
              <Button id="btn_add_medication" type="submit" isLoading={createMedication.isPending}
                className="w-full h-9 text-xs font-bold rounded-lg bg-[#E03E3E] text-white border-none shadow-none">
                <Plus className="w-4 h-4 mr-1.5" /> Add Medication
              </Button>
            </form>
          </Card>

          {/* Optics Prescription Builder */}
          <Card className="p-6 bg-white border border-gray-100 space-y-5 shadow-sm">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
              <Pill className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-gray-900 text-sm">Prescription Builder (Optics)</h2>
            </div>

            <form onSubmit={handleSavePrescription} className="space-y-4">
              
              {/* Right Eye (OD) */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Right Eye (OD)
                </span>
                
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">SPH</label>
                    <input 
                      id="od_sph_input"
                      type="number" step="0.25" placeholder="-2.00" value={odSph} onChange={(e) => setOdSph(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 focus:border-indigo-500 rounded-lg p-2 text-xs font-semibold text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">CYL</label>
                    <input 
                      id="od_cyl_input"
                      type="number" step="0.25" placeholder="-0.50" value={odCyl} onChange={(e) => setOdCyl(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 focus:border-indigo-500 rounded-lg p-2 text-xs font-semibold text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">AXIS</label>
                    <input 
                      id="od_axis_input"
                      type="number" placeholder="180" value={odAxis} onChange={(e) => setOdAxis(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 focus:border-indigo-500 rounded-lg p-2 text-xs font-semibold text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">ADD</label>
                    <input 
                      id="od_add_input"
                      type="number" step="0.25" placeholder="+1.50" value={odAdd} onChange={(e) => setOdAdd(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 focus:border-indigo-500 rounded-lg p-2 text-xs font-semibold text-gray-700"
                    />
                  </div>
                </div>
              </div>

              {/* Left Eye (OS) */}
              <div className="space-y-2.5 pt-1">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Left Eye (OS)
                </span>
                
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">SPH</label>
                    <input 
                      id="os_sph_input"
                      type="number" step="0.25" placeholder="-1.75" value={osSph} onChange={(e) => setOsSph(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 focus:border-indigo-500 rounded-lg p-2 text-xs font-semibold text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">CYL</label>
                    <input 
                      id="os_cyl_input"
                      type="number" step="0.25" placeholder="-0.75" value={osCyl} onChange={(e) => setOsCyl(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 focus:border-indigo-500 rounded-lg p-2 text-xs font-semibold text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">AXIS</label>
                    <input 
                      id="os_axis_input"
                      type="number" placeholder="170" value={osAxis} onChange={(e) => setOsAxis(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 focus:border-indigo-500 rounded-lg p-2 text-xs font-semibold text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase block mb-1">ADD</label>
                    <input 
                      id="os_add_input"
                      type="number" step="0.25" placeholder="+1.50" value={osAdd} onChange={(e) => setOsAdd(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-200 focus:border-indigo-500 rounded-lg p-2 text-xs font-semibold text-gray-700"
                    />
                  </div>
                </div>
              </div>

              {/* Pupillary Distance */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pupillary Distance (PD mm - Required)</label>
                <input 
                  id="pd_input"
                  type="number" placeholder="62" value={pd} onChange={(e) => setPd(e.target.value)}
                  className="w-full bg-gray-50/50 border border-gray-200 focus:border-indigo-500 rounded-xl p-3 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-gray-700"
                  required
                />
              </div>

              <Button 
                id="btn_issue_prescription"
                type="submit" 
                isLoading={submittingPrescription}
                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl text-xs transition-colors"
              >
                <Pill className="w-4 h-4 mr-1.5" /> Issue Eye Prescription
              </Button>
            </form>
          </Card>

          </div>{/* end right panel wrapper */}

        </div>

      </div>
    </div>
  );
}

export default SharedTelehealthRoomContainer;
