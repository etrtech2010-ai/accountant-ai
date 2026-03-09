"use client";

import { useState, useCallback } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface UploadedDoc {
  id: string;
  fileName: string;
  status: string;
}

export function DocumentUploadZone({ firmId }: { firmId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadedDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

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
          }),
        });

        if (res.ok) {
          const data = await res.json();
          uploadResults.push(data.document);
        }
      }

      setResults(uploadResults);
      setFiles([]);
    } catch (err) {
      setError("Upload failed. Please try again.");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
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
          Successfully uploaded {results.length} document
          {results.length !== 1 ? "s" : ""}. They&apos;re being processed now.
        </div>
      )}
    </div>
  );
}
