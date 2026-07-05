import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Eye, 
  FileSpreadsheet, 
  CreditCard, 
  ShieldCheck, 
  FolderHeart, 
  Video, 
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AttachmentUploader } from './AttachmentUploader';
import { useCreateConversation } from '@/services/messaging/messaging.hooks';
import { toast } from 'sonner';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (conversationId: string) => void;
}

const CATEGORIES = [
  { id: 'APPOINTMENT', name: 'Appointment Booking', icon: <Calendar className="w-5 h-5 text-blue-600" />, desc: 'Schedule, cancel or reschedule a clinic visit.' },
  { id: 'CONSULTATION', name: 'Eye Consultation', icon: <Eye className="w-5 h-5 text-[#E03E3E]" />, desc: 'Ask about ocular symptoms or eye concerns.' },
  { id: 'PRESCRIPTION', name: 'Prescription Question', icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />, desc: 'Inquire about renewals or lens prescriptions.' },
  { id: 'BILLING', name: 'Billing & Payments', icon: <CreditCard className="w-5 h-5 text-purple-600" />, desc: 'Invoices, payment issues or refund status.' },
  { id: 'INSURANCE', name: 'Insurance', icon: <ShieldCheck className="w-5 h-5 text-cyan-600" />, desc: 'Pre-authorizations, policies and coverage.' },
  { id: 'MEDICAL_RECORDS', name: 'Medical Records', icon: <FolderHeart className="w-5 h-5 text-rose-600" />, desc: 'Request clinical logs, scan results or histories.' },
  { id: 'TELEHEALTH', name: 'Telehealth Support', icon: <Video className="w-5 h-5 text-indigo-600" />, desc: 'Tech help regarding online video calls.' },
  { id: 'OTHER', name: 'Other Support', icon: <HelpCircle className="w-5 h-5 text-gray-500" />, desc: 'General queries not matched above.' },
];

export function NewConversationModal({ isOpen, onClose, onSuccess }: NewConversationModalProps) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const createMutation = useCreateConversation();

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 1 && !category) {
      toast.error('Please select a category first.');
      return;
    }
    if (step === 3 && !message.trim()) {
      toast.error('Please enter a description message.');
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = () => {
    if (!category || !message.trim()) return;

    createMutation.mutate({
      category,
      subject: subject || `${CATEGORIES.find(c => c.id === category)?.name} Request`,
      message,
      attachment_url: attachmentUrl || undefined
    }, {
      onSuccess: (data) => {
        toast.success('Conversation started successfully.');
        resetState();
        onSuccess(data.id);
        onClose();
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.detail || 'Failed to start conversation. Please try again.');
      }
    });
  };

  const resetState = () => {
    setStep(1);
    setCategory(null);
    setSubject('');
    setMessage('');
    setAttachmentUrl(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Dialog Content */}
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Start Conversation</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">Step {step} of 4</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-grow">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
                What do you need help with?
              </h3>
              <div className="grid grid-cols-1 gap-2.5">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCategory(c.id);
                      handleNext();
                    }}
                    className={`w-full text-left p-4 rounded-xl border flex items-center gap-4 transition-all duration-200 cursor-pointer ${
                      category === c.id 
                        ? 'border-[#E03E3E] bg-red-50/10 shadow-sm' 
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      {c.icon}
                    </div>
                    <div className="flex-grow">
                      <p className="text-sm font-bold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-medium">{c.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                Provide a Subject (Optional)
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                Enter a brief title summarizing your request to help our care team route it faster.
              </p>
              <div className="mt-4">
                <Input
                  type="text"
                  placeholder="e.g. Need to renew optical prescription"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="rounded-xl h-12"
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                Describe your message
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                Include as much detail as possible. Explain your concern so our medical agents can support you.
              </p>
              <div className="mt-4">
                <textarea
                  placeholder="Type your detailed message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-4 text-sm h-36 focus:outline-none focus:border-[#E03E3E] focus:ring-1 focus:ring-[#E03E3E]"
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                Upload Attachments (Optional)
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                Attach images or PDF files (scans, existing reports, doctor letters) up to 5MB.
              </p>
              <div className="mt-6">
                <AttachmentUploader
                  currentUrl={attachmentUrl}
                  onUploadSuccess={setAttachmentUrl}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 h-10 rounded-xl"
              disabled={createMutation.isPending}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button
              type="button"
              variant="default"
              onClick={handleNext}
              className="font-semibold text-xs uppercase tracking-wider bg-[#E03E3E] hover:bg-red-700 h-10 px-6 rounded-xl"
              disabled={step === 1 && !category}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              variant="default"
              onClick={handleSubmit}
              className="font-semibold text-xs uppercase tracking-wider bg-[#E03E3E] hover:bg-red-700 h-10 px-8 rounded-xl flex items-center gap-2"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
export default NewConversationModal;
