import { markMaterialComplete } from '@/api/analytics';
import { useAuthStore } from '@/store/auth';
import { listCourseEnrollments, type CourseEnrollmentWithStudent } from '@/api/enrollments';
import { listMaterials, uploadMaterial, deleteMaterial, type Material } from '@/api/materials';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input'; // if you have this in shadcn; otherwise use <input> directly
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCourse, type Course } from '@/api/courses';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type React from 'react';


export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { role } = useAuthStore();
  const [enrollments, setEnrollments] = useState<CourseEnrollmentWithStudent[]>([]);
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFileType, setUploadFileType] = useState<'video' | 'pdf'>('video');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCourse(id)
      .then((data) => {
        setCourse(data);
        setError(null);
      })
      .catch((e: any) => {
        setError(e?.response?.data?.error || 'Failed to load course');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (role !== 'Admin' && role !== 'Teacher') return;

    setEnrollmentsLoading(true);
    setEnrollmentsError(null);

    listCourseEnrollments(id)
      .then((data) => {
        setEnrollments(data);
      })
      .catch((e: any) => {
        setEnrollmentsError(e?.response?.data?.error || 'Failed to load enrollments');
      })
      .finally(() => setEnrollmentsLoading(false));
  }, [id, role]);

  useEffect(() => {
    if (!id) return;

    setMaterialsLoading(true);
    setMaterialsError(null);

    listMaterials(id)
      .then((data) => {
        setMaterials(data);
      })
      .catch((e: any) => {
        setMaterialsError(e?.response?.data?.error || 'Failed to load materials');
      })
      .finally(() => setMaterialsLoading(false));
  }, [id]);

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!uploadFile) {
      setUploadError('Please select a file');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      await uploadMaterial(id, {
        title: uploadTitle || uploadFile.name,
        description: uploadDescription || undefined,
        fileType: uploadFileType,
        file: uploadFile,
      });

      // Clear form and close dialog
      setUploadTitle('');
      setUploadDescription('');
      setUploadFile(null);
      setUploadFileType('video');
      setUploadOpen(false);

      // Refresh materials list
      setMaterialsLoading(true);
      const refreshed = await listMaterials(id);
      setMaterials(refreshed);
      setMaterialsError(null);
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || 'Failed to upload material');
    } finally {
      setUploading(false);
      setMaterialsLoading(false);
    }
  };
  const handleDeleteMaterial = async (materialId: string) => {
    if (!id) return;
    if (!(role === 'Admin' || role === 'Teacher')) return;

    try {
      await deleteMaterial(id, materialId);
      // Optimistically remove from local state
      setMaterials((prev) => prev.filter((m) => m.id !== materialId));
    } catch (err: any) {
      // reuse materialsError for now
      setMaterialsError(
        err?.response?.data?.error || 'Failed to delete material'
      );
    }
  };
  const handleVideoEnded = async (materialId: string) => {
    try {
      await markMaterialComplete(materialId);
    } catch (e) {
      console.error('Failed to mark video complete', e);
    }
  };


  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {course?.title || 'Course'}
          </h1>
          {course?.description && (
            <p className="text-sm text-gray-500 mt-1">
              {course.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(role === 'Admin' || role === 'Teacher') && (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  Upload material
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload material</DialogTitle>
                </DialogHeader>

                {uploadError && (
                  <div className="mb-2 text-xs text-red-600">{uploadError}</div>
                )}

                <form className="space-y-3" onSubmit={handleUploadMaterial}>
                  <div className="space-y-1">
                    <Label htmlFor="mat-title">Title</Label>
                    <input
                      id="mat-title"
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="Optional, defaults to file name"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="mat-desc">Description</Label>
                    <Textarea
                      id="mat-desc"
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="mat-type">Type</Label>
                    <select
                      id="mat-type"
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={uploadFileType}
                      onChange={(e) =>
                        setUploadFileType(e.target.value as 'video' | 'pdf')
                      }
                    >
                      <option value="video">Video</option>
                      <option value="pdf">PDF</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="mat-file">File</Label>
                    <input
                      id="mat-file"
                      type="file"
                      className="w-full text-sm"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>

                  <Button type="submit" size="sm" disabled={uploading}>
                    {uploading ? 'Uploading…' : 'Upload'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/courses')}>
            Back to courses
          </Button>
        </div>


        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course details</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div className="text-sm text-gray-500">Loading…</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            {!loading && !error && course && (
              <div className="space-y-1 text-sm text-gray-700">
                <div><span className="font-medium">ID:</span> {course.id}</div>
                {course.teacherId && (
                  <div><span className="font-medium">Teacher ID:</span> {course.teacherId}</div>
                )}
                {course.tenantId && (
                  <div><span className="font-medium">Tenant:</span> {course.tenantId}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>


        {(role === 'Admin' || role === 'Teacher') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Enrolled students</CardTitle>
            </CardHeader>
            <CardContent>
              {enrollmentsLoading && (
                <div className="text-sm text-gray-500">Loading…</div>
              )}
              {enrollmentsError && (
                <div className="text-sm text-red-600">{enrollmentsError}</div>
              )}
              {!enrollmentsLoading &&
                !enrollmentsError &&
                enrollments.length === 0 && (
                  <div className="text-sm text-gray-500">
                    No students enrolled yet.
                  </div>
                )}
              {!enrollmentsLoading &&
                !enrollmentsError &&
                enrollments.length > 0 && (
                  <ul className="text-sm space-y-1">
                    {enrollments.map((e) => (
                      <li key={e.id}>
                        {e.student?.username || e.studentId}{' '}
                        <span className="text-xs text-gray-500">
                          ({e.student?.role || 'Student'})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lecture videos</CardTitle>
          </CardHeader>
          <CardContent>
            {materialsLoading && (
              <div className="text-sm text-gray-500">Loading…</div>
            )}
            {materialsError && (
              <div className="text-sm text-red-600">{materialsError}</div>
            )}
            {!materialsLoading && !materialsError && (
              (() => {
                const videos = materials.filter((m) => m.fileType === 'video');
                if (videos.length === 0) {
                  return (
                    <div className="text-sm text-gray-500">
                      No lecture videos yet.
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    {videos.map((m) => (
                      <div key={m.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {m.title || 'Video'}
                          </span>
                          {(role === 'Admin' || role === 'Teacher') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200"
                              onClick={() => handleDeleteMaterial(m.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                        <video
                          controls
                          className="w-full max-w-2xl rounded border"
                          src={m.fileUrl || m.url || ''}
                          onEnded={() => handleVideoEnded(m.id)}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">PDF notes</CardTitle>
          </CardHeader>
          <CardContent>
            {materialsLoading && (
              <div className="text-sm text-gray-500">Loading…</div>
            )}
            {materialsError && (
              <div className="text-sm text-red-600">{materialsError}</div>
            )}
            {!materialsLoading && !materialsError && (
              (() => {
                const pdfs = materials.filter((m) => m.fileType === 'pdf');
                if (pdfs.length === 0) {
                  return (
                    <div className="text-sm text-gray-500">
                      No PDF notes yet.
                    </div>
                  );
                }
                return (
                  <ul className="text-sm space-y-2">
                    {pdfs.map((m) => (
                      <li key={m.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {m.title || 'Notes'}
                          </span>
                          {(role === 'Admin' || role === 'Teacher') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200"
                              onClick={() => handleDeleteMaterial(m.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs">
                          <a
                            href={m.fileUrl || m.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View
                          </a>
                          <a
                            href={m.fileUrl || m.url || '#'}
                            download
                            className="text-blue-600 hover:underline"
                          >
                            Download
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              })()
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}