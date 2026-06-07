import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage, auth } from '../firebaseConfig';
import type { Initiative } from '../hooks/useRecompute';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  FileText, 
  Image, 
  File, 
  Download, 
  Trash2, 
  Search, 
  AlertTriangle, 
  X, 
  CheckCircle,
  Link2
} from 'lucide-react';

interface DocumentManagerProps {
  userRole: string;
  initiatives: Initiative[];
  onAddAuditLog: (action: string, details: any) => Promise<void>;
}

interface DocumentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
  uploadedBy: string;
  uploadedById: string;
  uploadedAt: any;
  initiativeId?: string;
  initiativeName?: string;
  cycleId: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  error?: string;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  userRole,
  initiatives,
  onAddAuditLog
}) => {
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'images' | 'spreadsheets' | 'docs' | 'others'>('all');
  const [linkedInitiativeId, setLinkedInitiativeId] = useState('');
  
  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  
  // Upload progress tracking
  const [uploadQueue, setUploadQueue] = useState<Record<string, UploadProgress>>({});
  
  // General error/success state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cycleId = "2026-H2";

  // 1. Subscribe to documents metadata
  useEffect(() => {
    const q = query(
      collection(db, "documents"), 
      where("cycleId", "==", cycleId)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentMeta));
      // Sort by uploadedAt desc
      setDocuments(list.sort((a, b) => {
        const timeA = a.uploadedAt?.seconds || 0;
        const timeB = b.uploadedAt?.seconds || 0;
        return timeB - timeA;
      }));
      setLoading(false);
    }, (err) => {
      console.error("Firestore docs subscription failed:", err);
      setErrorMsg("Failed to sync documents list.");
      setLoading(false);
    });

    return unsub;
  }, []);

  // Format bytes helper
  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Helper to categorize file extensions
  const getFileCategory = (fileName: string, mimeType: string): 'images' | 'spreadsheets' | 'docs' | 'others' => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'].includes(ext) || mimeType.startsWith('image/')) {
      return 'images';
    }
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
      return 'spreadsheets';
    }
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'md'].includes(ext) || mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text')) {
      return 'docs';
    }
    return 'others';
  };

  // Helper to get file type icon
  const getFileIcon = (category: 'images' | 'spreadsheets' | 'docs' | 'others') => {
    switch (category) {
      case 'images':
        return <Image className="w-8 h-8 text-brand-blue" />;
      case 'spreadsheets':
        return <FileSpreadsheet className="w-8 h-8 text-emerald-400" />;
      case 'docs':
        return <FileText className="w-8 h-8 text-amber-400" />;
      default:
        return <File className="w-8 h-8 text-gray-400" />;
    }
  };

  // Upload handler
  const handleUploadFiles = async (files: FileList) => {
    if (userRole === 'viewer') {
      setErrorMsg("Viewers are not authorized to upload documents.");
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    const maxFileSize = 15 * 1024 * 1024; // 15MB limit
    
    Array.from(files).forEach((file) => {
      if (file.size > maxFileSize) {
        setErrorMsg(`File ${file.name} exceeds the maximum 15MB limit.`);
        return;
      }

      const uploadPath = `cycles/${cycleId}/documents/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, uploadPath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Track progress in state
      setUploadQueue(prev => ({
        ...prev,
        [uploadPath]: { fileName: file.name, progress: 0 }
      }));

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setUploadQueue(prev => ({
            ...prev,
            [uploadPath]: { ...prev[uploadPath], progress }
          }));
        }, 
        (err) => {
          console.error("Storage upload failed:", err);
          let errMsg = "Upload failed.";
          if (err.code === 'storage/unauthorized') {
            errMsg = "Upload unauthorized. Please verify Firebase Storage security rules are deployed.";
          }
          setUploadQueue(prev => ({
            ...prev,
            [uploadPath]: { ...prev[uploadPath], error: errMsg }
          }));
          setErrorMsg(`Failed to upload ${file.name}: ${errMsg}`);
        }, 
        async () => {
          // Success
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Link to initiative if selected
            let initName = "";
            if (linkedInitiativeId) {
              const matched = initiatives.find(i => i.id === linkedInitiativeId);
              if (matched) initName = matched.name;
            }

            // Save metadata in Firestore
            await addDoc(collection(db, "documents"), {
              name: file.name,
              size: file.size,
              type: file.type,
              url: downloadUrl,
              path: uploadPath,
              uploadedBy: auth.currentUser?.displayName || 'stornes@gmail.com',
              uploadedById: auth.currentUser?.uid || 'anonymous',
              uploadedAt: serverTimestamp(),
              initiativeId: linkedInitiativeId || null,
              initiativeName: initName || null,
              cycleId
            });

            // Write audit log
            await onAddAuditLog('document_upload', { name: file.name, size: file.size, initiativeId: linkedInitiativeId });
            
            // Remove from active progress queue
            setUploadQueue(prev => {
              const copy = { ...prev };
              delete copy[uploadPath];
              return copy;
            });

            setSuccessMsg(`Successfully uploaded ${file.name}`);
          } catch (dbErr) {
            console.error("Failed to save metadata in Firestore:", dbErr);
            setErrorMsg("File uploaded but failed to save document records.");
          }
        }
      );
    });
  };

  // Drag and Drop triggers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // Delete document handler
  const handleDeleteDocument = async (docMeta: DocumentMeta) => {
    if (userRole === 'viewer') {
      alert("Viewers are not authorized to delete documents.");
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete the document "${docMeta.name}"?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Delete from Storage
      const storageRef = ref(storage, docMeta.path);
      try {
        await deleteObject(storageRef);
      } catch (storageErr: any) {
        // Log warning but continue to delete metadata in case file doesn't exist in Storage
        console.warn("Storage delete failed or file missing, cleaning metadata:", storageErr);
      }

      // 2. Delete from Firestore
      await deleteDoc(doc(db, "documents", docMeta.id));

      // 3. Log Audit
      await onAddAuditLog('document_delete', { name: docMeta.name, id: docMeta.id });

      setSuccessMsg(`Successfully deleted ${docMeta.name}`);
    } catch (err) {
      console.error("Failed to delete document:", err);
      setErrorMsg(`Failed to delete document ${docMeta.name}`);
    }
  };

  // Filter and search logic
  const filteredDocuments = documents.filter(doc => {
    // Search query filter
    const matchesSearch = 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.initiativeName && doc.initiativeName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // File type filter
    if (selectedFilter === 'all') return true;
    const cat = getFileCategory(doc.name, doc.type);
    return cat === selectedFilter;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Documents & Attachments</h1>
          <p className="text-sm text-gray-400 mt-1">Upload and link project requirements, Excel spreadsheets, or diagrams to your roadmap initiatives.</p>
        </div>
      </div>

      {/* Upload Zone (Only for Editor/Admin) */}
      {userRole !== 'viewer' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Drag & Drop Card */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`col-span-2 glass-card p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
              isDragging 
                ? 'border-brand-purple bg-brand-purple/5 shadow-inner' 
                : 'border-white/5 hover:border-brand-purple/40 hover:bg-white/[0.01]'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              multiple
              onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
              className="hidden" 
            />
            <UploadCloud className={`w-12 h-12 mb-3 transition-transform duration-200 ${isDragging ? 'scale-110 text-brand-purple' : 'text-gray-400'}`} />
            <p className="text-sm font-semibold text-white">Drag & drop files here, or <span className="text-brand-purple">browse</span></p>
            <p className="text-xs text-gray-500 mt-1.5">Supports Images, Excel Spreadsheets, PDFs, Word Docs (Up to 15MB)</p>
          </div>

          {/* Upload Settings / Target Initiative */}
          <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-brand-purple" />
                <span>Link Uploads to Initiative</span>
              </h3>
              <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
                Select an initiative from the dropdown below before uploading to automatically bind files to that stream project.
              </p>
              <select
                value={linkedInitiativeId}
                onChange={(e) => setLinkedInitiativeId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-white/5 rounded-xl text-xs text-white focus:outline-none focus:border-brand-purple/50 cursor-pointer"
              >
                <option value="">-- No linked initiative (General File) --</option>
                {initiatives.map((init) => (
                  <option key={init.id} value={init.id}>
                    {init.id}: {init.name}
                  </option>
                ))}
              </select>
            </div>
            {linkedInitiativeId && (
              <div className="flex items-center gap-2 p-2 bg-brand-purple/10 border border-brand-purple/20 rounded-xl text-[10px] text-brand-purple">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Selected file(s) will associate with {initiatives.find(i => i.id === linkedInitiativeId)?.name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Upload Progress Logs */}
      {Object.keys(uploadQueue).length > 0 && (
        <div className="glass-card p-4 rounded-2xl border border-white/5 space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Active Uploads</h4>
          <div className="space-y-2">
            {Object.entries(uploadQueue).map(([path, fileProgress]) => (
              <div key={path} className="text-xs">
                <div className="flex justify-between text-[11px] text-gray-300 font-medium mb-1">
                  <span className="truncate max-w-[70%]">{fileProgress.fileName}</span>
                  <span>{fileProgress.progress}%</span>
                </div>
                <div className="w-full bg-gray-950 rounded-full h-1.5 overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-brand-purple rounded-full transition-all duration-150"
                    style={{ width: `${fileProgress.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Alerts */}
      {errorMsg && (
        <div className="p-4 bg-red-950/20 border border-red-500/20 text-red-300 text-xs rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Document Grid Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between pb-2 border-b border-white/5">
        {/* Categories */}
        <div className="flex flex-wrap gap-1.5 bg-gray-950/30 border border-white/5 p-1 rounded-xl">
          {(['all', 'images', 'spreadsheets', 'docs', 'others'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors ${
                selectedFilter === filter 
                  ? 'bg-brand-purple text-white shadow' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search files or initiatives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-950/40 border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-purple/50"
          />
        </div>
      </div>

      {/* Grid of Files */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center space-y-2">
          <File className="w-10 h-10 text-gray-600" />
          <h3 className="font-semibold text-white text-sm">No Documents Found</h3>
          <p className="text-xs text-gray-500 max-w-sm">
            {searchQuery || selectedFilter !== 'all' 
              ? "No files match the active search queries or filters." 
              : "Upload project briefs, spreadsheets, and drawings to get started."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => {
            const category = getFileCategory(doc.name, doc.type);
            const dateStr = doc.uploadedAt?.seconds 
              ? new Date(doc.uploadedAt.seconds * 1000).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) 
              : 'Uploading...';

            return (
              <div 
                key={doc.id} 
                className="glass-card rounded-2xl border border-white/5 overflow-hidden flex flex-col justify-between hover:border-brand-purple/20 transition-all duration-200"
              >
                {/* Visual Preview / Icon Section */}
                <div className="h-32 bg-gray-950/50 flex items-center justify-center border-b border-white/5 relative overflow-hidden group">
                  {category === 'images' ? (
                    <img 
                      src={doc.url} 
                      alt={doc.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                      onError={(e) => {
                        // Fail fallback to default icon
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    getFileIcon(category)
                  )}

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-gray-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center space-x-3 transition-opacity duration-200">
                    <a 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-gray-900 border border-white/10 rounded-xl text-gray-200 hover:text-white hover:border-brand-purple/40 transition-colors shadow-lg"
                      title="Download File"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {userRole !== 'viewer' && (
                      <button 
                        onClick={() => handleDeleteDocument(doc)}
                        className="p-2 bg-gray-900 border border-white/10 rounded-xl text-gray-400 hover:text-red-400 hover:border-red-500/20 transition-colors shadow-lg cursor-pointer"
                        title="Delete File"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Info Section */}
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-white truncate" title={doc.name}>
                      {doc.name}
                    </h4>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>{formatBytes(doc.size)}</span>
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  {/* Link Details */}
                  {doc.initiativeId && doc.initiativeName ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-purple/10 border border-brand-purple/15 rounded-lg text-[9px] text-brand-purple font-medium truncate max-w-full">
                      <Link2 className="w-3 h-3 shrink-0" />
                      <span className="truncate" title={`${doc.initiativeId}: ${doc.initiativeName}`}>
                        Linked: {doc.initiativeId}
                      </span>
                    </div>
                  ) : (
                    <div className="h-5.5" /> // Spacer
                  )}

                  {/* Attribution */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-[9px] text-gray-500">
                    <span>By {doc.uploadedBy.split('@')[0]}</span>
                    <span className="uppercase tracking-wider font-semibold text-white/40">{category}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
