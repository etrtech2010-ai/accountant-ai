"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UploadedDoc {
  id: string;
  fileName: string;
  status: string;
}

interface ClientRef {
  id: string;
  name: string;
}

export function DocumentUploadZone({
  firmId,
  clients,
}: {
  firmId: string;
  clients: ClientRef[];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadedDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      ["application/pdf", "image/png", "image/jpeg", "image/heic"].includes(
        f.type
      )
    );
    setFiles((prev) => [...prev, ...dropped].slice(0, 20));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter((f) =>
        ["application/pdf", "image/png", "image/jpeg", "image/heic"].includes(f.type)
      );
      setFiles((prev) => [...prev, ...selected].slice(0, 20));
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const uploadResults: UploadedDoc[] = [];

      for (const file of files) {
        // Upload to Supabase Storage
        const fileExt = file.name.split(".").pop();
        const filePath = `${firmId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: storageError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (storageError) {
          console.error("Storage error:", storageError);
          setError(`Failed to upload ${file.name}: ${storageError.message}`);
          continue;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("documents").getPublicUrl(filePath);

        // Create document record and trigger processing
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileUrl: publicUrl,
            fileType: fileExt,
            fileSizeBytes: file.size,
            storagePath: filePath,
            clientId: selectedClientId || undefined,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          uploadResults.push(data.document);
        }
      }

      setResults(uploadResults);
      setFiles([]);
      // Refresh server component so new documents appear in the table
      router.refresh();
    } catch (err) {
      setError("Upload failed. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Client Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground whitespace-nowrap">
          Assign to Client
        </label>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Unassigned</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-16 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
      >
        <Upload className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-4 text-sm font-medium text-foreground">
          Drag & drop files here
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, PNG, JPG, HEIC — up to 10MB each, 20 files max
        </p>
        <label className="mt-4 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
          Browse Files
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.heic"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
              {selectedClientId && clients.find((c) => c.id === selectedClientId) && (
                <span className="ml-2 text-xs text-muted-foreground">
                  → {clients.find((c) => c.id === selectedClientId)!.name}
                </span>
              )}
            </span>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload & Process
                </>
              )}
            </button>
          </div>
          <div className="space-y-2">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="rounded p-1 hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-emerald-700">
          Successfully processed {results.length} document
          {results.length !== 1 ? "s" : ""}. Check the Review Queue to approve extracted items.
        </div>
      )}
    </div>
  );
}
