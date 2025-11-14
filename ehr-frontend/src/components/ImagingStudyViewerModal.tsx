import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  AlertTriangle,
  Upload,
  Trash2,
  Info,
  Images,
  ShieldAlert,
  Loader2,
  MessageSquare,
  Sparkles,
  CreditCard,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';
import { ehrApi } from '../services/api';
import { useNotification } from './GlobalNotification';
import ImagingDicomViewport from './ImagingDicomViewport';
import ImagingReportComposer from './ImagingReportComposer';
import ModalPortal from './ModalPortal';

interface ImagingStudyViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  study: any | null;
  tenantSlug: string;
  token: string;
  onRefresh?: () => Promise<void> | void;
  isLoading?: boolean;
  loadError?: boolean;
  currentUser?: any;
}

interface ImagingFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: 'DICOM' | 'JPEG' | 'PNG' | 'PDF' | 'TIFF';
  file_size?: number;
  image_number?: number;
  view_position?: string;
  is_primary?: boolean;
  uploaded_at?: string;
  uploaded_by_name?: string;
}

interface ImagingAnnotationRecord {
  id: string;
  annotation_type: string;
  annotation_text?: string | null;
  annotation_data?: any;
  created_at?: string;
  user_name?: string;
}

const fileTypeToDisplay = {
  DICOM: 'DICOM (medical image)',
  JPEG: 'JPEG image',
  PNG: 'PNG image',
  PDF: 'PDF document',
  TIFF: 'TIFF image',
};

const humanFileSize = (size?: number) => {
  if (!size) return 'Unknown size';
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const determineFileType = (file: File): ImagingFile['file_type'] => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext) return 'PNG';
  if (ext === 'dcm') return 'DICOM';
  if (ext === 'jpg' || ext === 'jpeg') return 'JPEG';
  if (ext === 'png') return 'PNG';
  if (ext === 'pdf') return 'PDF';
  if (ext === 'tiff' || ext === 'tif') return 'TIFF';
  if (file.type.includes('dicom')) return 'DICOM';
  if (file.type.includes('jpeg')) return 'JPEG';
  if (file.type.includes('png')) return 'PNG';
  if (file.type.includes('pdf')) return 'PDF';
  if (file.type.includes('tiff')) return 'TIFF';
  return 'PNG';
};

const getImageDataUrl = (file: ImagingFile) => {
  if (!file?.file_path) return '';
  if (file.file_path.startsWith('http')) return file.file_path;
  if (file.file_path.startsWith('data:')) return file.file_path;
  return file.file_path;
};

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return `$${numeric.toFixed(2)}`;
};

const ImagingStudyViewerModal: React.FC<ImagingStudyViewerModalProps> = ({
  isOpen,
  onClose,
  study,
  tenantSlug,
  token,
  onRefresh,
  isLoading = false,
  loadError = false,
  currentUser,
}) => {
  const { showError, showSuccess } = useNotification();
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'images' | 'report' | 'details'>('images');
  const [annotationsMap, setAnnotationsMap] = useState<Record<string, ImagingAnnotationRecord[]>>({});
  const [annotationsLoading, setAnnotationsLoading] = useState(false);
  const annotationLoadIdRef = useRef<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ imageId: string; fileName: string } | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const images: ImagingFile[] = useMemo(() => study?.images || [], [study]);
  const selectedImage = useMemo(() => {
    if (images.length === 0) return null;
    if (!selectedImageId) return images[0];
    return images.find((img) => img.id === selectedImageId) || images[0];
  }, [images, selectedImageId]);

  const isDicomSelected = selectedImage?.file_type === 'DICOM';

  const dicomImages = useMemo(() => images.filter((img) => img.file_type === 'DICOM'), [images]);
  const currentDicomIndex = useMemo(() => {
    if (!selectedImage || selectedImage.file_type !== 'DICOM') return -1;
    return dicomImages.findIndex((img) => img.id === selectedImage.id);
  }, [dicomImages, selectedImage]);

  const awaitingPayment =
    study?.payment_status === 'awaiting_payment' || study?.order_status === 'awaiting_payment';
  const financeReference = study?.finance_transaction_id || null;
  const feeEstimate = formatCurrency(study?.fee_amount);

  const canAnnotate = currentUser?.role === 'radiologist' && !awaitingPayment;
  const uploadDisabled =
    uploading || awaitingPayment || (currentUser?.role && currentUser.role !== 'radiologist');

  const safeNormalizeAnnotations = useCallback((raw: any[] = []) => {
    return raw.map((annotation) => {
      let parsedData = annotation.annotation_data;
      if (typeof parsedData === 'string') {
        try {
          parsedData = JSON.parse(parsedData);
        } catch (err) {
          parsedData = parsedData;
        }
      }
      return {
        ...annotation,
        annotation_data: parsedData,
      } as ImagingAnnotationRecord;
    });
  }, []);

  const loadAnnotations = useCallback(
    async (imageId: string) => {
      annotationLoadIdRef.current = imageId;
      setAnnotationsLoading(true);
      try {
        const { data } = await ehrApi.getImageAnnotations(tenantSlug, token, imageId);
        const normalized = safeNormalizeAnnotations(data.annotations || []);
        setAnnotationsMap((prev) => ({
          ...prev,
          [imageId]: normalized,
        }));
      } catch (error: any) {
        console.error('Failed to load annotations', error);
        const message = error?.response?.data?.message || 'Failed to load annotations';
        showError(message);
      } finally {
        if (annotationLoadIdRef.current === imageId) {
          setAnnotationsLoading(false);
          annotationLoadIdRef.current = null;
        }
      }
    },
    [safeNormalizeAnnotations, showError, tenantSlug, token],
  );

  const handleAnnotationCreated = useCallback(
    async (
      imageId: string,
      annotation: { annotation_type: string; annotation_text?: string; annotation_data?: any },
      options: { muteSuccess?: boolean } = {},
    ) => {
      try {
        await ehrApi.addImageAnnotation(tenantSlug, token, imageId, annotation);
        await loadAnnotations(imageId);
        if (!options.muteSuccess) {
          showSuccess('Annotation saved');
        }
      } catch (error: any) {
        console.error('Failed to save annotation', error);
        const message = error?.response?.data?.message || 'Failed to save annotation';
        showError(message);
      }
    },
    [loadAnnotations, showError, showSuccess, tenantSlug, token],
  );

  const handleNoteSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedImage?.id || !noteText.trim()) return;
      setSavingNote(true);
      try {
        await handleAnnotationCreated(selectedImage.id, {
          annotation_type: 'note',
          annotation_text: noteText.trim(),
        });
        setNoteText('');
      } finally {
        setSavingNote(false);
      }
    },
    [handleAnnotationCreated, noteText, selectedImage?.id],
  );

  const handleStackIndexChange = useCallback(
    (index: number) => {
      const clamped = Math.min(Math.max(index, 0), dicomImages.length - 1);
      const target = dicomImages[clamped];
      if (target) {
        setSelectedImageId(target.id);
      }
    },
    [dicomImages],
  );

  useEffect(() => {
    if (isDicomSelected && selectedImage?.id) {
      loadAnnotations(selectedImage.id);
    }
  }, [isDicomSelected, loadAnnotations, selectedImage?.id]);

  const currentAnnotations = useMemo(() => {
    if (!selectedImage?.id) return [] as ImagingAnnotationRecord[];
    return annotationsMap[selectedImage.id] || [];
  }, [annotationsMap, selectedImage?.id]);

  useEffect(() => {
    setNoteText('');
  }, [selectedImage?.id]);

  const describeAnnotation = useCallback((annotation: ImagingAnnotationRecord) => {
    const type = (annotation.annotation_type || '').toLowerCase();
    if (type === 'note' && annotation.annotation_text) {
      return annotation.annotation_text;
    }

    const data = annotation.annotation_data || {};
    if (type.includes('length') || data.toolType?.toLowerCase() === 'length') {
      const lengthValue = data.length ?? data.cachedStats?.length ?? data.distance ?? null;
      const unit = data.unit || data.units || 'mm';
      if (lengthValue != null) {
        return `Length measurement: ${Number(lengthValue).toFixed(1)} ${unit}`;
      }
    }

    if (annotation.annotation_text) {
      return annotation.annotation_text;
    }

    if (Object.keys(data || {}).length > 0) {
      return JSON.stringify(data);
    }

    return 'Annotation saved';
  }, []);

  const handleClose = () => {
    setSelectedImageId(null);
    setUploading(false);
    setTab('images');
    onClose();
  };

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!study?.id) return;
      const file = event.target.files?.[0];
      if (!file) return;

      if (awaitingPayment) {
        showError('Payment confirmation required before uploading images.');
        event.target.value = '';
        return;
      }

      if (file.size > 75 * 1024 * 1024) {
        showError('File size exceeds 75MB limit');
        return;
      }

      try {
        setUploading(true);
        const base64 = await toBase64(file);
        const fileType = determineFileType(file);

        const payload = {
          file_name: file.name,
          file_path: base64,
          file_type: fileType,
          file_size: file.size,
          image_number: images.length + 1,
          view_position: undefined,
          is_primary: images.length === 0,
        };

        await ehrApi.uploadImagingStudyImage(tenantSlug, token, study.id, payload);
        showSuccess('Image uploaded successfully');
        if (onRefresh) {
          await onRefresh();
        }
      } catch (error) {
        console.error('Failed to upload image', error);
        showError('Failed to upload image');
      } finally {
        setUploading(false);
        event.target.value = '';
      }
    },
    [awaitingPayment, images.length, onRefresh, showError, showSuccess, study?.id, tenantSlug, token],
  );

  const performDeleteImage = useCallback(
    async (imageId: string) => {
      if (!study?.id) return false;

      try {
        setDeletingImageId(imageId);
        await ehrApi.deleteImagingStudyImage(tenantSlug, token, study.id, imageId);
        showSuccess('Image deleted');
        if (onRefresh) {
          await onRefresh();
        }
        return true;
      } catch (error) {
        console.error('Failed to delete image', error);
        showError('Failed to delete image');
        return false;
      } finally {
        setDeletingImageId((current) => (current === imageId ? null : current));
      }
    },
    [onRefresh, showError, showSuccess, study?.id, tenantSlug, token],
  );

  const requestDeleteImage = useCallback(
    (image: ImagingFile) => {
      if (!study?.id) return;

      if (awaitingPayment) {
        showError('Payment confirmation required before modifying study images.');
        return;
      }

      setDeleteConfirm({ imageId: image.id, fileName: image.file_name });
    },
    [awaitingPayment, showError, study?.id],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const success = await performDeleteImage(deleteConfirm.imageId);
    if (success) {
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, performDeleteImage]);

  if (!isOpen) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
          <p className="text-sm text-slate-600">Loading imaging study…</p>
          <button
            onClick={handleClose}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!study) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-10 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 mx-auto text-red-400" />
          <p className="text-base font-semibold text-slate-800">Unable to load imaging study</p>
          <p className="text-sm text-slate-600">
            {loadError
              ? 'We could not retrieve the imaging data. Please try again or contact support if the issue persists.'
              : 'Study data is not available.'}
          </p>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const studyDateDisplay = study.study_date ? format(new Date(study.study_date), 'dd MMM yyyy') : 'N/A';
  const patientAge = study.date_of_birth
    ? Math.floor((Date.now() - new Date(study.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 'N/A';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal>
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <p className="text-xs uppercase tracking-wider text-indigo-600 font-semibold mb-1">Study Viewer</p>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Images className="w-5 h-5 text-indigo-500" />
              {study.study_name}
            </h2>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-2">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {study.patient_name} ({study.patient_number})
              </span>
              <span>
                Age {patientAge}, {study.gender}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {studyDateDisplay}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {study.study_time?.substring(0, 5) || 'N/A'}
              </span>
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3" /> {study.modality_code}
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
            aria-label="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          <div className="w-full lg:w-2/3 border-r bg-slate-50 flex flex-col">
            {awaitingPayment && (
              <div className="px-4 py-3 border-b border-amber-200 bg-amber-50 text-amber-700 flex items-start gap-3">
                <Lock className="w-4 h-4 flex-shrink-0 mt-1" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">Awaiting payment confirmation</p>
                  <p>
                    Finance must confirm payment before reporting, annotations, or image uploads are permitted for this
                    study.
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs text-amber-600">
                    {feeEstimate && <span className="font-medium">Estimated fee: {feeEstimate}</span>}
                    {financeReference && (
                      <span>
                        Finance reference: <span className="font-mono">{financeReference}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-white">
              <button
                onClick={() => setTab('images')}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  tab === 'images'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 hover:bg-indigo-50'
                }`}
              >
                Images ({images.length})
              </button>
              <button
                onClick={() => setTab('report')}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  tab === 'report'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 hover:bg-indigo-50'
                }`}
              >
                Report
              </button>
              <button
                onClick={() => setTab('details')}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                  tab === 'details'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 hover:bg-indigo-50'
                }`}
              >
                Study Details
              </button>
            </div>

            <div className="flex-1 overflow-auto relative">
              {tab === 'images' && (
                <div className="flex flex-col lg:flex-row h-full">
                  <div className="lg:w-1/4 border-b lg:border-b-0 lg:border-r bg-white overflow-auto">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Available Images</span>
                        <span>{images.length}</span>
                      </div>

                      {images.length === 0 && (
                        <div className="text-center py-10 text-sm text-slate-500 border rounded-xl">
                          <ShieldAlert className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                          No images uploaded yet
                        </div>
                      )}

                      <div className="space-y-2">
                        {images.map((img) => (
                          <button
                            key={img.id}
                            onClick={() => setSelectedImageId(img.id)}
                            className={`w-full text-left border rounded-xl p-3 transition-all ${
                              selectedImage?.id === img.id
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            <p className="text-sm font-semibold text-slate-800 truncate">{img.file_name}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {fileTypeToDisplay[img.file_type]} · {humanFileSize(img.file_size)}
                            </p>
                            {img.view_position && (
                              <p className="text-xs text-slate-400 mt-1">View: {img.view_position}</p>
                            )}
                            {img.is_primary && (
                              <span className="inline-block mt-2 text-[10px] font-medium text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">
                                Primary image
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    <div className="flex-1 bg-slate-900 relative overflow-hidden">
                      {!selectedImage && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                          <Images className="w-10 h-10 mx-auto mb-4" />
                          <p>No image selected</p>
                        </div>
                      )}

                      {selectedImage && selectedImage.file_type !== 'DICOM' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <img
                            src={getImageDataUrl(selectedImage)}
                            alt={selectedImage.file_name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      )}

                      {selectedImage && selectedImage.file_type === 'DICOM' && (
                        <div className="absolute inset-0">
                          <ImagingDicomViewport
                            image={selectedImage}
                            imageStack={dicomImages}
                            currentIndex={currentDicomIndex >= 0 ? currentDicomIndex : undefined}
                            onIndexChange={handleStackIndexChange}
                            annotations={currentAnnotations}
                            readOnly={!canAnnotate}
                            onCreateAnnotation={canAnnotate ? handleAnnotationCreated : undefined}
                            overlay={
                              <div className="text-right leading-tight">
                                <p className="font-semibold">{study.patient_name}</p>
                                <p className="text-[10px] text-slate-200">{study.study_name}</p>
                              </div>
                            }
                            onError={(err) => {
                              console.error('DICOM viewer error', err);
                              showError('Unable to render DICOM image. Please download and open externally.');
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {selectedImage && (
                      <div className="bg-white border-t px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-4">
                          <span>File: <span className="font-medium text-slate-800">{selectedImage.file_name}</span></span>
                          <span>Type: {fileTypeToDisplay[selectedImage.file_type]}</span>
                          <span>Size: {humanFileSize(selectedImage.file_size)}</span>
                          {selectedImage.uploaded_by_name && (
                            <span>Uploaded by {selectedImage.uploaded_by_name}</span>
                          )}
                          {selectedImage.uploaded_at && (
                            <span>
                              Uploaded {format(new Date(selectedImage.uploaded_at), 'dd MMM yyyy HH:mm')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={getImageDataUrl(selectedImage)}
                            download={selectedImage.file_name}
                            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                          >
                            Download
                          </a>
                          <button
                            onClick={() => requestDeleteImage(selectedImage)}
                            className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'report' && study && (
                <div className="p-8 overflow-auto h-full bg-white">
                  <div className="max-w-4xl mx-auto">
                    {awaitingPayment ? (
                      <div className="border border-amber-200 bg-amber-50 text-amber-700 rounded-2xl p-6 flex items-start gap-3">
                        <CreditCard className="w-6 h-6 mt-1 flex-shrink-0" />
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">Reporting locked</p>
                          <p className="text-sm">
                            This study cannot be drafted or signed until Accounts confirms payment. Refresh the study
                            once the payment status updates to continue.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <ImagingReportComposer
                        tenantSlug={tenantSlug}
                        token={token}
                        study={study}
                        currentUser={currentUser}
                        onRefresh={onRefresh}
                      />
                    )}
                  </div>
                </div>
              )}

              {tab === 'details' && (
                <div className="p-8 overflow-auto h-full bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="border rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Patient</h3>
                        <dl className="space-y-2 text-sm text-slate-600">
                          <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="font-medium">{study.patient_name}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-500">Patient #</dt><dd className="font-medium">{study.patient_number}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-500">DOB</dt><dd className="font-medium">{study.date_of_birth ? format(new Date(study.date_of_birth), 'dd MMM yyyy') : 'N/A'}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-500">Gender</dt><dd className="font-medium uppercase">{study.gender || 'N/A'}</dd></div>
                        </dl>
                      </div>

                      <div className="border rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Order Details</h3>
                        <dl className="space-y-2 text-sm text-slate-600">
                          <div className="flex justify-between"><dt className="text-slate-500">Accession</dt><dd className="font-medium">{study.accession_number}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-500">Modality</dt><dd className="font-medium">{study.modality_name}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-500">Technologist</dt><dd className="font-medium">{study.technologist_name || 'Not recorded'}</dd></div>
                          <div className="flex justify-between"><dt className="text-slate-500">Assigned Radiologist</dt><dd className="font-medium">{study.radiologist_name || 'Unassigned'}</dd></div>
                          {study.snomed_concept_id && (
                            <>
                              <div className="flex justify-between border-t pt-2 mt-2"><dt className="text-slate-500">SNOMED Code</dt><dd className="font-medium font-mono text-xs">{study.snomed_concept_id}</dd></div>
                              <div className="flex justify-between"><dt className="text-slate-500">SNOMED Term</dt><dd className="font-medium">{study.snomed_term || 'N/A'}</dd></div>
                              {study.cpt_code && (
                                <div className="flex justify-between"><dt className="text-slate-500">CPT Code</dt><dd className="font-medium font-mono text-xs">{study.cpt_code}</dd></div>
                              )}
                            </>
                          )}
                        </dl>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="border rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Clinical Context</h3>
                        <p className="text-sm text-slate-600 whitespace-pre-line bg-slate-50 border rounded-lg p-4">
                          {study.clinical_indication || 'No clinical indication provided.'}
                        </p>
                      </div>

                      <div className="border rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Technique Notes</h3>
                        <dl className="space-y-2 text-sm text-slate-600">
                          <div className="flex justify-between"><dt className="text-slate-500">Contrast Used</dt><dd className="font-medium">{study.contrast_used ? 'Yes' : 'No'}</dd></div>
                          {study.contrast_type && (
                            <div className="flex justify-between"><dt className="text-slate-500">Contrast Type</dt><dd className="font-medium">{study.contrast_type}</dd></div>
                          )}
                          {study.contrast_volume && (
                            <div className="flex justify-between"><dt className="text-slate-500">Contrast Volume</dt><dd className="font-medium">{study.contrast_volume}</dd></div>
                          )}
                          {study.radiation_dose && (
                            <div className="flex justify-between"><dt className="text-slate-500">Radiation Dose</dt><dd className="font-medium">{study.radiation_dose}</dd></div>
                          )}
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-1/3 bg-white flex flex-col border-t lg:border-t-0">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Upload / Attachments</p>
                  <h3 className="text-lg font-semibold text-slate-800">Additional Images</h3>
                </div>
                <label
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    uploadDisabled
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Uploading…' : 'Add Image'}
                  <input
                    type="file"
                    accept=".dcm,.dicom,.jpg,.jpeg,.png,.tiff,.tif,.pdf,image/*,application/pdf"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploadDisabled}
                  />
                </label>
              </div>
              {awaitingPayment && (
                <div className="mt-3 border border-amber-200 bg-amber-50 text-amber-700 rounded-xl p-3 text-xs">
                  Uploading and editing study files is paused until Accounts clears the payment.
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">
                Supports DICOM, JPEG, PNG, TIFF, PDF (up to 75MB). Uploaded files are stored securely for audit purposes.
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="border border-indigo-100 bg-indigo-50 rounded-xl p-4 text-sm text-indigo-800">
                <p className="font-semibold mb-1">Workflow Guidance</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Review modalities in the viewer panel.</li>
                  <li>Upload patient-provided external images here.</li>
                  <li>Draft and sign reports under the Report tab.</li>
                </ul>
              </div>

              <div className="border rounded-xl p-4 bg-slate-50">
                <p className="text-xs uppercase text-slate-500 font-semibold mb-2">Summary</p>
                <dl className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <dt>Images</dt>
                    <dd className="font-medium">{images.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Status</dt>
                    <dd className="font-medium capitalize">{study.study_status?.replace(/_/g, ' ') || 'Pending'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Payment</dt>
                    <dd
                      className={`font-medium ${
                        awaitingPayment ? 'text-amber-600' : 'text-emerald-600'
                      } capitalize`}
                    >
                      {study.payment_status ? study.payment_status.replace(/_/g, ' ') : 'Not required'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Report</dt>
                    <dd className="font-medium">{study.report ? study.report.report_status?.toUpperCase() : 'Not started'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Priority</dt>
                    <dd className="font-medium uppercase">{study.priority || 'Routine'}</dd>
                  </div>
                </dl>
              </div>

              {isDicomSelected && (
                <div className="border rounded-xl p-4 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs uppercase text-slate-500 font-semibold">Annotations</p>
                      <p className="text-sm text-slate-600">Image markup & radiologist notes</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full bg-indigo-50 text-indigo-600">
                      <Sparkles className="w-3 h-3" />
                      {currentAnnotations.length}
                    </span>
                  </div>

                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                    {annotationsLoading ? (
                      <div className="flex items-center justify-center py-6 text-slate-500 text-sm gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading annotations…
                      </div>
                    ) : currentAnnotations.length === 0 ? (
                      <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-4 text-center">
                        No annotations captured for this slice.
                      </div>
                    ) : (
                      currentAnnotations.map((annotation) => {
                        const summary = describeAnnotation(annotation);
                        const rawDataString = annotation.annotation_data ? JSON.stringify(annotation.annotation_data, null, 2) : null;
                        const shouldShowRaw = Boolean(
                          rawDataString && typeof summary === 'string' && summary === JSON.stringify(annotation.annotation_data)
                        );

                        return (
                          <div key={annotation.id} className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-slate-700 truncate">
                                {(annotation.annotation_type || 'annotation').replace(/_/g, ' ').toUpperCase()}
                              </span>
                              <span className="text-xs text-slate-400">
                                {annotation.user_name || 'Radiologist'}
                                {annotation.created_at && (
                                  <span className="ml-2 text-slate-300">
                                    {format(new Date(annotation.created_at), 'dd MMM yyyy HH:mm')}
                                  </span>
                                )}
                              </span>
                            </div>
                            <p className="text-slate-600 whitespace-pre-wrap">
                              {summary}
                            </p>
                            {shouldShowRaw && rawDataString && (
                              <pre className="mt-2 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[10px] text-slate-500 overflow-x-auto">
                                {rawDataString}
                              </pre>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {canAnnotate && (
                    <form onSubmit={handleNoteSubmit} className="mt-4 space-y-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> Add Radiologist Note
                      </label>
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="Document key observations or communication to clinicians"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={!noteText.trim() || savingNote}
                          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {savingNote ? 'Saving…' : 'Add Note'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {study.report?.is_critical && (
                <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700">
                  <p className="font-semibold flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4" /> Critical Finding Flag
                  </p>
                  <p className="text-sm">This study report includes critical findings. Ensure clinical team acknowledgment.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {deleteConfirm && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-10 text-center space-y-4">
              <ShieldAlert className="w-12 h-12 mx-auto text-red-400" />
              <p className="text-base font-semibold text-slate-800">Confirm Deletion</p>
              <p className="text-sm text-slate-600">
                Are you sure you want to delete "{deleteConfirm.fileName}"? This action cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default ImagingStudyViewerModal;
