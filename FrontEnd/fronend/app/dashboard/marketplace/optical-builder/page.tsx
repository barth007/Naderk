"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Upload,
  Check,
  Info,
  ShoppingCart,
  AlertCircle,
  RefreshCw,

} from 'lucide-react';
import {
  useFrames,
  useLensTypes,
  useLensOptions,
  useReusablePrescriptions,
  useSubmitPrescription,
  useAddToCart,

} from '@/services/marketplace/marketplace.hooks';
import { Frame, FrameVariant, LensType, LensOption, Prescription } from '@/services/marketplace/marketplace.types';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/components/ui/breadcrumb';


export default function OpticalBuilderPage() {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<number>(1);

  // Selections
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null);
  const [selectedFrameVariant, setSelectedFrameVariant] = useState<FrameVariant | null>(null);
  const [selectedLensType, setSelectedLensType] = useState<LensType | null>(null);
  const [selectedLensOptions, setSelectedLensOptions] = useState<LensOption[]>([]);
  const [prescriptionOption, setPrescriptionOption] = useState<'existing' | 'upload' | 'manual'>('existing');
  
  // Existing Prescription selection
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  // Manual input values
  const [rightSph, setRightSph] = useState<string>('0.00');
  const [rightCyl, setRightCyl] = useState<string>('0.00');
  const [rightAxis, setRightAxis] = useState<string>('0');
  const [rightAdd, setRightAdd] = useState<string>('0.00');
  const [leftSph, setLeftSph] = useState<string>('0.00');
  const [leftCyl, setLeftCyl] = useState<string>('0.00');
  const [leftAxis, setLeftAxis] = useState<string>('0');
  const [leftAdd, setLeftAdd] = useState<string>('0.00');
  const [pupillaryDistance, setPupillaryDistance] = useState<string>('63');
  
  // File Upload State
  const [fileUrl, setFileUrl] = useState<string>('');
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Review status states

  // API Hooks
  const { data: frames = [], isLoading: loadingFrames } = useFrames();

  // Brand filter derived from loaded frames
  const uniqueBrands = useMemo(
    () => [...new Set(frames.map(f => f.brand))].sort(),
    [frames]
  );
  const visibleFrames = selectedBrand
    ? frames.filter(f => f.brand === selectedBrand)
    : frames;
  const { data: lensTypes = [], isLoading: loadingLensTypes } = useLensTypes();
  const { data: lensOptions = [], isLoading: loadingLensOptions } = useLensOptions();
  const { data: reusablePrescriptions = [], refetch: refetchReusable } = useReusablePrescriptions();
  
  const submitPrescriptionMutation = useSubmitPrescription();
  const addToCartMutation = useAddToCart();

  // Reset variables when frame changes
  useEffect(() => {
    if (selectedFrame && selectedFrame.variants.length > 0) {
      setSelectedFrameVariant(selectedFrame.variants[0]);
    }
  }, [selectedFrame]);

  // Calculate live total price
  const calculateTotal = () => {
    let total = 0;
    if (selectedFrame) {
      total += parseFloat(selectedFrame.base_price);
    }
    if (selectedLensType) {
      total += parseFloat(selectedLensType.price_modifier);
    }
    if (selectedLensOptions.length > 0) {
      total += selectedLensOptions.reduce((sum, opt) => sum + parseFloat(opt.price_modifier), 0);
    }
    return total;
  };

  // Real File upload selector handler
  const handleUploadBoxClick = (e: React.MouseEvent) => {
    e.preventDefault();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingFile(true);
      setTimeout(() => {
        // Mock a Cloudinary path but showing the real file chosen by the user
        const mockCloudinaryUrl = `https://res.cloudinary.com/naderk/image/upload/v1672531199/marketplace/prescriptions/${encodeURIComponent(file.name)}`;
        setFileUrl(mockCloudinaryUrl);
        setIsUploadingFile(false);
        toast.success(`Selected file "${file.name}" loaded!`);
      }, 1000);
    }
  };

  // Compatibility checking helper
  const isLensCompatible = (lensId: string) => {
    if (!selectedFrame) return false;
    return true;
  };

  // Move forward in steps with validations
  const handleNextStep = () => {
    if (step === 1 && !selectedFrameVariant) {
      toast.error("Please select a frame and color/size variant first.");
      return;
    }
    if (step === 2 && !selectedLensType) {
      toast.error("Please select a lens type first.");
      return;
    }
    if (step === 4) {
      if (prescriptionOption === 'existing' && !selectedPrescription) {
        toast.error("Please select an approved prescription, or enter manual values.");
        return;
      }
      if (prescriptionOption === 'upload' && !fileUrl) {
        toast.error("Please upload your prescription PDF or image.");
        return;
      }
      if (prescriptionOption === 'manual') {
        const pd = parseFloat(pupillaryDistance);
        if (isNaN(pd) || pd < 40 || pd > 80) {
          toast.error("Pupillary Distance must be between 40 and 80 mm.");
          return;
        }
      }
    }
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  // Submit configuration
  // Step 5 primary action — collect prescription then go straight to checkout.
  // Payment happens first; prescription review happens after payment on the backend.
  const handleProceedToCheckout = () => {
    if (!selectedFrameVariant || !selectedLensType) return;

    // Existing approved prescription — add to cart immediately and pay
    if (prescriptionOption === 'existing') {
      if (!selectedPrescription) {
        toast.error('Please select a prescription first.');
        return;
      }
      handleAddEyewearToCart(selectedPrescription.id);
      return;
    }

    // Upload or manual — save prescription record first, then add to cart and pay
    const pd = parseFloat(pupillaryDistance);
    const payload: any = { pupillary_distance: isNaN(pd) ? 63 : pd };

    const num = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const int = (v: string) => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };

    if (prescriptionOption === 'upload') {
      payload.prescription_file = fileUrl || null;
    } else {
      payload.right_sph  = num(rightSph);
      payload.right_cyl  = num(rightCyl);
      payload.right_axis = int(rightAxis);
      payload.right_add  = num(rightAdd);
      payload.left_sph   = num(leftSph);
      payload.left_cyl   = num(leftCyl);
      payload.left_axis  = int(leftAxis);
      payload.left_add   = num(leftAdd);
    }

    submitPrescriptionMutation.mutate(payload, {
      onSuccess: (newRx) => {
        // Prescription saved — now add eyewear to cart and go to payment
        handleAddEyewearToCart(newRx.id);
      },
      onError: (err: any) => {
        const detail = err.response?.data?.detail || 'Failed to save prescription. Please check your values.';
        toast.error(detail);
      },
    });
  };

  // Add configured eyewear to cart then proceed directly to checkout
  const handleAddEyewearToCart = (rxId: string) => {
    if (!selectedFrameVariant || !selectedLensType) return;

    addToCartMutation.mutate({
      frame_variant_id: selectedFrameVariant.id,
      lens_type_id: selectedLensType.id,
      lens_option_ids: selectedLensOptions.map(o => o.id),
      prescription_id: rxId,
      quantity: 1
    }, {
      onSuccess: () => {
        toast.success("Eyewear added to cart — proceeding to checkout!");
        router.push('/dashboard/checkout');
      },
      onError: (err: any) => {
        const detail = err.response?.data?.detail || "Failed to add configured eyewear to cart.";
        toast.error(detail);
      }
    });
  };

const stepNames = ["Choose Frame", "Select Lens", "Upgrades", "Prescription", "Submit & Checkout"];

  return (
    <div className="w-full bg-[#f8f9fc] min-h-screen text-[#1f2937]">
      
      {/* Breadcrumbs Sub-Header */}
      <div className="bg-white px-6 rounded-xl border border-gray-100 mb-6">
        <Breadcrumbs />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl border border-gray-100">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider text-[#ff052f] flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Glasses Builder Wizard
          </span>
          <h1 className="text-2xl font-extrabold text-[#111827]">Optical Configuration Studio</h1>
        </div>
        <button 
          onClick={() => router.push('/dashboard/marketplace')}
          className="text-xs font-bold text-gray-500 hover:text-[#ff052f] transition bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl"
        >
          Exit Builder
        </button>
      </div>

      {step <= 6 && (
        <div className="mb-8 bg-white p-5 rounded-2xl border border-gray-100">
          {/* Stepper bar */}
          <div className="flex items-center justify-between relative max-w-3xl mx-auto">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-gray-100 z-0"></div>
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#ff052f] z-0 transition-all duration-300"
              style={{ width: `${((step - 1) / (stepNames.length - 1)) * 100}%` }}
            ></div>
            
            {stepNames.map((name, idx) => {
              const active = idx + 1 <= step;
              const current = idx + 1 === step;
              return (
                <div key={name} className="relative z-10 flex flex-col items-center">
                  <div 
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition duration-300 border-2 ${
                      current 
                        ? 'bg-white border-[#ff052f] text-[#ff052f] shadow-sm' 
                        : active 
                        ? 'bg-[#ff052f] border-[#ff052f] text-white' 
                        : 'bg-white border-gray-200 text-gray-400'
                    }`}
                  >
                    {active && idx + 1 < step ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span className="hidden md:block text-[9px] uppercase font-bold tracking-wider mt-2 text-gray-500">
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main wizard step content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start mb-8">
        
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 md:p-7 min-h-[400px]">
          <AnimatePresence mode="wait">
            
            {/* Step 1: Choose Frame */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-[#1f2937]">Step 1: Choose Your Designer Frame</h2>
                  <p className="text-gray-400 text-xs mt-1">Select a model frame style, color, and fit sizes.</p>
                </div>

                {/* Brand filter pills */}
                {!loadingFrames && uniqueBrands.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedBrand(null)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                        selectedBrand === null
                          ? 'bg-[#ff052f] text-white border-[#ff052f]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      All Brands
                    </button>
                    {uniqueBrands.map(brand => (
                      <button
                        key={brand}
                        onClick={() => setSelectedBrand(selectedBrand === brand ? null : brand)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                          selectedBrand === brand
                            ? 'bg-[#ff052f] text-white border-[#ff052f]'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                )}

                {loadingFrames ? (
                  <div className="py-20 flex justify-center"><RefreshCw className="animate-spin text-[#ff052f]" /></div>
                ) : visibleFrames.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">
                    No frames found for <span className="font-bold text-gray-600">{selectedBrand}</span>.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {visibleFrames.map((frame) => (
                      <div 
                        key={frame.id}
                        onClick={() => setSelectedFrame(frame)}
                        className={`p-4 rounded-xl border transition duration-300 cursor-pointer flex flex-col justify-between ${
                          selectedFrame?.id === frame.id 
                            ? 'border-[#ff052f] bg-[#fff5f6]' 
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="aspect-video bg-gray-50 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                          {frame.front_image ? (
                            <img src={frame.front_image} alt={frame.name} className="object-contain w-full h-full p-2" />
                          ) : (
                            <span className="text-xs uppercase font-extrabold tracking-wider text-gray-400">
                              {frame.brand} {frame.style}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[9px] text-[#ff052f] font-bold uppercase tracking-wider block mb-0.5">{frame.brand}</span>
                          <h3 className="font-bold text-gray-900 text-xs md:text-sm leading-tight">{frame.name}</h3>
                          <p className="text-[10px] text-gray-400 mt-1">{frame.material} &bull; {frame.style}</p>
                          <span className="font-extrabold text-gray-900 text-sm mt-2 block">₦{Number(frame.base_price).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Variant Color & Size Selector */}
                {selectedFrame && (
                  <div className="border-t border-gray-100 pt-6 space-y-4">
                    <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Frame Color & Size Details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedFrame.variants.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => setSelectedFrameVariant(v)}
                          className={`p-3 rounded-xl border cursor-pointer text-xs flex justify-between items-center transition ${
                            selectedFrameVariant?.id === v.id
                              ? 'border-[#ff052f] bg-[#fff5f6] font-semibold text-[#ff052f]'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-gray-900">Color: {v.color}</p>
                            <p className="text-gray-400 mt-0.5">Size: {v.size}</p>
                          </div>
                          {selectedFrameVariant?.id === v.id && <Check className="w-4 h-4 text-[#ff052f]" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Select Lens Type */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-[#1f2937]">Step 2: Choose Vision Lens Type</h2>
                  <p className="text-gray-400 text-xs mt-1">Select lens options according to your daily vision needs.</p>
                </div>

                {loadingLensTypes ? (
                  <div className="py-20 flex justify-center"><RefreshCw className="animate-spin text-[#ff052f]" /></div>
                ) : (
                  <div className="space-y-3">
                    {lensTypes.map((lens) => {
                      const compatible = isLensCompatible(lens.id);
                      return (
                        <div
                          key={lens.id}
                          onClick={() => compatible && setSelectedLensType(lens)}
                          className={`p-4 rounded-xl border transition duration-300 flex justify-between items-center ${
                            !compatible 
                              ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50' 
                              : selectedLensType?.id === lens.id
                              ? 'border-[#ff052f] bg-[#fff5f6] cursor-pointer'
                              : 'border-gray-100 hover:border-gray-200 cursor-pointer'
                          }`}
                        >
                          <div className="flex-1 pr-4">
                            <h3 className="font-bold text-gray-900 text-xs md:text-sm">{lens.name}</h3>
                            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{lens.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-gray-900 block text-sm">+₦{Number(lens.price_modifier).toLocaleString()}</span>
                            {selectedLensType?.id === lens.id && (
                              <span className="inline-block mt-2 bg-[#ff052f] text-white p-0.5 rounded-full"><Check className="w-3.5 h-3.5" /></span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Upgrades */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-[#1f2937]">Step 3: Vision Lens Upgrades</h2>
                  <p className="text-gray-400 text-xs mt-1">Add protective coatings or light transition modifications.</p>
                </div>

                {loadingLensOptions ? (
                  <div className="py-20 flex justify-center"><RefreshCw className="animate-spin text-[#ff052f]" /></div>
                ) : (
                  <div className="space-y-3">
                    {lensOptions.map((opt) => {
                      const isSelected = selectedLensOptions.some(o => o.id === opt.id);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedLensOptions(selectedLensOptions.filter(o => o.id !== opt.id));
                            } else {
                              setSelectedLensOptions([...selectedLensOptions, opt]);
                            }
                          }}
                          className={`p-4 rounded-xl border cursor-pointer transition duration-300 flex justify-between items-center ${
                            isSelected
                              ? 'border-[#ff052f] bg-[#fff5f6]'
                              : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div>
                            <h3 className="font-bold text-gray-900 text-xs md:text-sm">{opt.name}</h3>
                            <p className="text-[11px] text-gray-400 mt-1">Enhance your eyeglasses with high performance filters.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-gray-900 text-sm">+₦{Number(opt.price_modifier).toLocaleString()}</span>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                              isSelected ? 'bg-[#ff052f] border-[#ff052f] text-white' : 'border-gray-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Prescription Setup */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-[#1f2937]">Step 4: Prescription Credentials</h2>
                  <p className="text-gray-400 text-xs mt-1">Select an existing verified prescription or input custom optometry metrics.</p>
                </div>

                {/* Sub Options selector */}
                <div className="grid grid-cols-3 gap-2 p-1 bg-gray-50 rounded-xl border border-gray-200/60">
                  <button
                    onClick={() => {
                      setPrescriptionOption('existing');
                      refetchReusable();
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                      prescriptionOption === 'existing' ? 'bg-white text-[#ff052f] shadow-xs' : 'text-gray-400'
                    }`}
                  >
                    Reusable Rx
                  </button>
                  <button
                    onClick={() => setPrescriptionOption('upload')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                      prescriptionOption === 'upload' ? 'bg-white text-[#ff052f] shadow-xs' : 'text-gray-400'
                    }`}
                  >
                    Upload Rx PDF
                  </button>
                  <button
                    onClick={() => setPrescriptionOption('manual')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                      prescriptionOption === 'manual' ? 'bg-white text-[#ff052f] shadow-xs' : 'text-gray-400'
                    }`}
                  >
                    Manual Entry
                  </button>
                </div>

                {/* Dynamic fields based on option */}
                {prescriptionOption === 'existing' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Approved Reusable Prescriptions</p>
                    {reusablePrescriptions.length === 0 ? (
                      <div className="p-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <AlertCircle className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                        <h4 className="font-semibold text-gray-600 text-xs">No reusable prescription found</h4>
                        <p className="text-[10px] text-gray-400 mt-1">You must upload a document or enter values manually to get evaluated.</p>
                      </div>
                    ) : (
                      reusablePrescriptions.map((rx) => (
                        <div
                          key={rx.id}
                          onClick={() => setSelectedPrescription(rx)}
                          className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition ${
                            selectedPrescription?.id === rx.id ? 'border-[#ff052f] bg-[#fff5f6]' : 'border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          <div className="text-[11px] space-y-1">
                            <p className="font-bold text-gray-900">Approved on: {new Date(rx.created_at).toLocaleDateString()}</p>
                            <p className="text-gray-400">Right Eye SPH: {rx.right_sph} | Left Eye SPH: {rx.left_sph}</p>
                            <p className="text-gray-400">PD: {rx.pupillary_distance} mm</p>
                          </div>
                          {selectedPrescription?.id === rx.id && <Check className="w-4 h-4 text-[#ff052f]" />}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {prescriptionOption === 'upload' && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Select and upload prescription file</p>
                    
                    {/* Native Hidden File Input */}
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="application/pdf,image/*"
                      className="hidden"
                    />

                    <div 
                      onClick={handleUploadBoxClick}
                      className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50 hover:bg-gray-100/50 transition cursor-pointer"
                    >
                      {isUploadingFile ? (
                        <div className="space-y-3">
                          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#ff052f]" />
                          <p className="text-xs font-bold text-[#ff052f]">Reading local file system...</p>
                        </div>
                      ) : fileUrl ? (
                        <div className="space-y-2">
                          <div className="w-8 h-8 rounded-full bg-green-50 text-green-500 flex items-center justify-center mx-auto"><Check className="w-4 h-4" /></div>
                          <p className="text-xs font-bold text-gray-800">Prescription File Selected</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-xs mx-auto">{fileUrl.split('/').pop()}</p>
                          <span className="text-[10px] text-[#ff052f] font-semibold underline block mt-2">Change File</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Upload className="w-8 h-8 mx-auto text-gray-400" />
                          <div>
                            <p className="text-xs font-bold text-gray-700">Browse and upload prescription file</p>
                            <p className="text-[10px] text-gray-400 mt-1">Supports PDF, PNG, JPG (Cloudinary protected)</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Pupillary Distance (PD) *</label>
                      <input 
                        type="number" 
                        value={pupillaryDistance} 
                        onChange={(e) => setPupillaryDistance(e.target.value)}
                        className="px-3 py-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-xl text-xs bg-[#f8f9fc]"
                        placeholder="63"
                      />
                    </div>
                  </div>
                )}

                {prescriptionOption === 'manual' && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Manual Optometry Form (Valid ranges apply)</p>
                    
                    {/* Right Eye */}
                    <div className="border border-gray-100 p-4 rounded-xl bg-gray-50/50 space-y-3">
                      <h4 className="font-bold text-[10px] text-gray-600 uppercase tracking-wider">Right Eye (OD)</h4>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="text-gray-400 block mb-1 text-[9px] uppercase font-bold">SPH</label>
                          <input type="text" value={rightSph} onChange={e => setRightSph(e.target.value)} className="w-full p-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-lg bg-white" />
                        </div>
                        <div>
                          <label className="text-gray-400 block mb-1 text-[9px] uppercase font-bold">CYL</label>
                          <input type="text" value={rightCyl} onChange={e => setRightCyl(e.target.value)} className="w-full p-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-lg bg-white" />
                        </div>
                        <div>
                          <label className="text-gray-400 block mb-1 text-[9px] uppercase font-bold">AXIS</label>
                          <input type="text" value={rightAxis} onChange={e => setRightAxis(e.target.value)} className="w-full p-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-lg bg-white" />
                        </div>
                        <div>
                          <label className="text-gray-400 block mb-1 text-[9px] uppercase font-bold">ADD</label>
                          <input type="text" value={rightAdd} onChange={e => setRightAdd(e.target.value)} className="w-full p-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-lg bg-white" />
                        </div>
                      </div>
                    </div>

                    {/* Left Eye */}
                    <div className="border border-gray-100 p-4 rounded-xl bg-gray-50/50 space-y-3">
                      <h4 className="font-bold text-[10px] text-gray-600 uppercase tracking-wider">Left Eye (OS)</h4>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="text-gray-400 block mb-1 text-[9px] uppercase font-bold">SPH</label>
                          <input type="text" value={leftSph} onChange={e => setLeftSph(e.target.value)} className="w-full p-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-lg bg-white" />
                        </div>
                        <div>
                          <label className="text-gray-400 block mb-1 text-[9px] uppercase font-bold">CYL</label>
                          <input type="text" value={leftCyl} onChange={e => setLeftCyl(e.target.value)} className="w-full p-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-lg bg-white" />
                        </div>
                        <div>
                          <label className="text-gray-400 block mb-1 text-[9px] uppercase font-bold">AXIS</label>
                          <input type="text" value={leftAxis} onChange={e => setLeftAxis(e.target.value)} className="w-full p-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-lg bg-white" />
                        </div>
                        <div>
                          <label className="text-gray-400 block mb-1 text-[9px] uppercase font-bold">ADD</label>
                          <input type="text" value={leftAdd} onChange={e => setLeftAdd(e.target.value)} className="w-full p-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-lg bg-white" />
                        </div>
                      </div>
                    </div>

                    {/* Pupillary Distance */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">Pupillary Distance (PD) *</label>
                      <input 
                        type="number" 
                        value={pupillaryDistance} 
                        onChange={(e) => setPupillaryDistance(e.target.value)}
                        className="px-3 py-2 border border-gray-200 focus:outline-none focus:border-[#ff052f] rounded-xl text-xs bg-[#f8f9fc]"
                        placeholder="63"
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 5: Summary & Submit */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-[#1f2937]">Step 6: Submission Summary</h2>
                  <p className="text-gray-400 text-xs mt-1">Review your configurations before submitting to the approval queue.</p>
                </div>

                <div className="border border-gray-100 rounded-2xl p-5 bg-gray-50/50 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Selected Model Frame</span>
                    <span className="text-xs font-bold text-gray-900">{selectedFrame?.name} ({selectedFrameVariant?.color})</span>
                  </div>
                  
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lens Vision Type</span>
                    <span className="text-xs font-bold text-gray-900">{selectedLensType?.name}</span>
                  </div>

                  {selectedLensOptions.length > 0 && (
                    <div className="pb-2 border-b border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Selected Upgrades</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedLensOptions.map((opt) => (
                          <span key={opt.id} className="text-[9px] font-extrabold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {opt.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prescription Route</span>
                    <span className="text-[9px] font-bold text-[#ff052f] uppercase bg-[#fff5f6] border border-[#ffccd3] px-2 py-0.5 rounded-full">
                      {prescriptionOption === 'existing' ? 'Approved Reusable' : prescriptionOption === 'upload' ? 'Cloudinary File Upload' : 'Manual Entry'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs font-extrabold text-gray-900">Total Price Calculated</span>
                    <span className="text-xl font-black text-[#ff052f]">₦{calculateTotal().toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-[#fff5f6] border border-[#ffccd3] rounded-xl p-4 flex gap-3 text-xs text-[#a0001a] leading-relaxed">
                  <Info className="w-5 h-5 text-[#ff052f] shrink-0" />
                  <div>
                    <span className="font-bold block mb-0.5">Optician Review Mandate:</span>
                    Custom prescription orders require optical verification before order placement. Selecting reusable approved prescription bypasses the queue immediately.
                  </div>
                </div>

                {/* Primary submission action inside the left form content */}
                <div className="pt-2">
                  <button
                    onClick={handleProceedToCheckout}
                    disabled={submitPrescriptionMutation.isPending || addToCartMutation.isPending}
                    className="w-full bg-[#ff052f] hover:bg-[#d90022] text-white text-xs font-bold py-3 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-red-100"
                  >
                    {(submitPrescriptionMutation.isPending || addToCartMutation.isPending) ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-4 h-4" />
                    )}
                    <span>
                      {submitPrescriptionMutation.isPending ? 'Saving prescription…' :
                       addToCartMutation.isPending ? 'Adding to cart…' :
                       'Proceed to Checkout & Pay'}
                    </span>
                  </button>
                </div>
              </motion.div>
            )}

            
          </AnimatePresence>
        </div>

        {/* Right side summary checkout panel */}
        {step <= 5 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-6">
            <h3 className="font-extrabold text-[10px] text-gray-400 uppercase tracking-wider">Live Config Spec</h3>
            
            {/* Display Frame */}
            {selectedFrame ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                  <img src={selectedFrame.front_image || 'https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=100'} className="object-contain w-full h-full p-1" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 text-xs">{selectedFrame.name}</h4>
                  <p className="text-[10px] text-gray-400">Color: {selectedFrameVariant?.color || 'Selected Color'}</p>
                </div>
                <span className="font-extrabold text-xs text-gray-900 ml-auto">₦{Number(selectedFrame.base_price).toLocaleString()}</span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No frame selected</p>
            )}

            {/* Display Lens Type */}
            {selectedLensType ? (
              <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
                <div className="w-7 h-7 rounded-full bg-[#fff5f6] text-[#ff052f] flex items-center justify-center shrink-0 font-bold text-xs">L</div>
                <div>
                  <h4 className="font-bold text-gray-800 text-xs">{selectedLensType.name}</h4>
                  <p className="text-[10px] text-gray-400">Vision Glass Lens Type</p>
                </div>
                <span className="font-extrabold text-xs text-gray-900 ml-auto">+₦{Number(selectedLensType.price_modifier).toLocaleString()}</span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic pt-3 border-t border-gray-50">No lens selection</p>
            )}

            {/* Display Upgrades */}
            {selectedLensOptions.length > 0 && (
              <div className="pt-3 border-t border-gray-50 space-y-2">
                {selectedLensOptions.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-green-50 text-green-500 flex items-center justify-center shrink-0 font-bold text-[9px]"><Check className="w-3.5 h-3.5" /></div>
                    <span className="text-xs font-bold text-gray-600">{opt.name}</span>
                    <span className="font-extrabold text-xs text-gray-900 ml-auto">+₦{Number(opt.price_modifier).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Estimated Pricing Total */}
            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Subtotal:</span>
              <span className="text-xl font-black text-gray-900">₦{calculateTotal().toLocaleString()}</span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-2">
              {step < 5 ? (
                <button
                  onClick={handleNextStep}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer text-xs"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="space-y-2">
                  {prescriptionOption !== 'existing' ? (
                    <button
                      onClick={handleProceedToCheckout}
                      disabled={submitPrescriptionMutation.isPending}
                      className="w-full bg-[#ff052f] hover:bg-[#d90022] text-white font-bold py-3 rounded-xl shadow-md shadow-red-100 flex items-center justify-center gap-2 transition cursor-pointer text-xs"
                    >
                      {submitPrescriptionMutation.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>Submit For Review</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAddEyewearToCart(selectedPrescription?.id || '')}
                      disabled={addToCartMutation.isPending || !selectedPrescription}
                      className="w-full bg-[#ff052f] hover:bg-[#d90022] text-white font-bold py-3 rounded-xl shadow-md shadow-red-100 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      {addToCartMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                      <span>Proceed to Checkout</span>
                    </button>
                  )}
                </div>
              )}


              {step > 1 && (
                <button
                  onClick={handlePrevStep}
                  className="w-full bg-transparent hover:bg-gray-50 border border-gray-200 text-gray-600 font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer text-xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
