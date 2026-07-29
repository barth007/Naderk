'use client';

import React, { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, PenLine, Upload, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import {
  TableContainer, Table, TableHead, TableBody, TableRow, Th, Td,
} from '@/components/ui/table';
import {
  useMyBlogs, useCreateBlog, useUpdateBlog, useDeleteBlog, usePublishBlog, useDraftBlog,
  type BlogAuthorPost, type BlogPostInput,
} from '@/services/cms/admin-cms.hooks';
import { useCategories } from '@/services/cms/cms.hooks';
import { apiClient } from '@/lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_FORM: BlogPostInput = {
  title: '',
  content: '',
  excerpt: '',
  image_url: '',
  category_id: null,
  meta_title: '',
  meta_description: '',
  meta_keywords: '',
};

// ── Image uploader ────────────────────────────────────────────────────────────

function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post('/messages/upload/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.data.url);
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">Cover Image</label>
      <div className="flex items-center gap-2">
        <input
          className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
          placeholder="https://..."
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Upload
        </button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {value && (
        <div className="mt-1.5 w-16 h-12 rounded-md overflow-hidden border border-gray-100">
          <img src={value} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BlogAuthorPost['status'] }) {
  const map = {
    DRAFT: 'text-gray-600 bg-gray-50 border-gray-200',
    PUBLISHED: 'text-green-700 bg-green-50 border-green-100',
    ARCHIVED: 'text-orange-600 bg-orange-50 border-orange-100',
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${map[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ── Blog editor modal ─────────────────────────────────────────────────────────

interface EditorModalProps {
  initial: BlogPostInput & { id?: number };
  onClose: () => void;
}

function EditorModal({ initial, onClose }: EditorModalProps) {
  const [form, setForm] = useState<BlogPostInput & { id?: number }>(initial);
  const { data: categoriesResponse } = useCategories();
  const categories = categoriesResponse?.data?.results ?? [];
  const create = useCreateBlog();
  const update = useUpdateBlog();

  function set(k: keyof BlogPostInput, v: unknown) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function submit(status: 'DRAFT' | 'PUBLISHED') {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    try {
      if (form.id) {
        await update.mutateAsync({ ...form, id: form.id, status });
      } else {
        await create.mutateAsync({ ...form, status });
      }
      toast.success(status === 'PUBLISHED' ? 'Article published!' : 'Saved as draft');
      onClose();
    } catch {
      toast.error('Failed to save article');
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-md shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">
            {form.id ? 'Edit Article' : 'New Article'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Title *</label>
            <input
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
              placeholder="Article title..."
              value={form.title}
              onChange={e => set('title', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Excerpt</label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E] resize-none"
              placeholder="Short description shown in article cards..."
              value={form.excerpt ?? ''}
              onChange={e => set('excerpt', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E] bg-white"
              value={form.category_id ?? ''}
              onChange={e => set('category_id', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <ImageUploader value={form.image_url ?? ''} onChange={v => set('image_url', v)} />

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Content *</label>
            <textarea
              rows={12}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E] resize-none"
              placeholder="Write your article here..."
              value={form.content}
              onChange={e => set('content', e.target.value)}
            />
          </div>

          <details className="group">
            <summary className="text-xs font-bold text-gray-500 cursor-pointer hover:text-gray-700 list-none flex items-center gap-1">
              SEO (optional)
            </summary>
            <div className="mt-3 space-y-3 pl-2 border-l-2 border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Meta Title</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
                  value={form.meta_title ?? ''}
                  onChange={e => set('meta_title', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Meta Description</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E] resize-none"
                  value={form.meta_description ?? ''}
                  onChange={e => set('meta_description', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Keywords</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-md text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#E03E3E]"
                  placeholder="eye health, vision care, ..."
                  value={form.meta_keywords ?? ''}
                  onChange={e => set('meta_keywords', e.target.value)}
                />
              </div>
            </div>
          </details>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => submit('DRAFT')}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save as Draft
          </button>
          <button
            onClick={() => submit('PUBLISHED')}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-white bg-[#E03E3E] hover:bg-red-700 rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Publish Now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DoctorBlogPage() {
  const { data: blogs = [], isLoading } = useMyBlogs();
  const deleteBlog = useDeleteBlog();
  const publishBlog = usePublishBlog();
  const draftBlog = useDraftBlog();

  const [modal, setModal] = useState<(BlogPostInput & { id?: number }) | null>(null);

  function openNew() { setModal({ ...EMPTY_FORM }); }
  function openEdit(blog: BlogAuthorPost) {
    setModal({
      id: blog.id,
      title: blog.title,
      content: blog.content,
      excerpt: blog.excerpt,
      image_url: blog.image_url,
      category_id: blog.category?.id ?? null,
      meta_title: blog.meta_title,
      meta_description: blog.meta_description,
      meta_keywords: blog.meta_keywords,
    });
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this article permanently?')) return;
    try {
      await deleteBlog.mutateAsync(id);
      toast.success('Article deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function handlePublish(blog: BlogAuthorPost) {
    try {
      if (blog.status === 'PUBLISHED') {
        await draftBlog.mutateAsync(blog.id);
        toast.success('Reverted to draft');
      } else {
        await publishBlog.mutateAsync(blog.id);
        toast.success('Article published!');
      }
    } catch {
      toast.error('Action failed');
    }
  }

  const publishedCount = blogs.filter(b => b.status === 'PUBLISHED').length;

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-red-50 flex items-center justify-center text-[#E03E3E]">
            <PenLine className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">My Articles</h1>
            <p className="text-xs text-gray-500 font-medium">
              {publishedCount} published · {blogs.length - publishedCount} draft
            </p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#E03E3E] hover:bg-red-700 text-white text-xs font-bold rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Article
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs font-semibold text-gray-500">Total Articles</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{blogs.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-gray-500">Published</p>
          <p className="text-2xl font-extrabold text-green-600 mt-1">{publishedCount}</p>
        </Card>
        <Card className="p-4 col-span-2 sm:col-span-1">
          <p className="text-xs font-semibold text-gray-500">Drafts</p>
          <p className="text-2xl font-extrabold text-gray-400 mt-1">{blogs.length - publishedCount}</p>
        </Card>
      </div>

      {/* Table */}
      <TableContainer className="rounded-md border border-gray-100 shadow-sm">
        <Table>
          <TableHead>
            <TableRow>
              <Th className="px-4 py-3 text-xs">Article</Th>
              <Th className="px-4 py-3 text-xs">Category</Th>
              <Th className="px-4 py-3 text-xs">Status</Th>
              <Th className="px-4 py-3 text-xs">Date</Th>
              <Th className="px-4 py-3 text-xs">Actions</Th>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </Td>
                  ))}
                </TableRow>
              ))
            ) : blogs.length === 0 ? (
              <TableRow>
                <Td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-400 font-semibold">
                  <div className="flex flex-col items-center gap-2">
                    <PenLine className="w-8 h-8 text-gray-200" />
                    <p>No articles yet. Write your first one!</p>
                  </div>
                </Td>
              </TableRow>
            ) : blogs.map(blog => (
              <TableRow key={blog.id}>
                <Td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {blog.image_url ? (
                      <div className="w-10 h-10 rounded-md overflow-hidden border border-gray-100 flex-shrink-0">
                        <img src={blog.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <PenLine className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold text-gray-900 line-clamp-1">{blog.title}</p>
                      <p className="text-[10px] text-gray-400">{blog.reading_time}</p>
                    </div>
                  </div>
                </Td>
                <Td className="px-4 py-3 text-xs text-gray-500">
                  {blog.category?.name ?? '—'}
                </Td>
                <Td className="px-4 py-3">
                  <StatusBadge status={blog.status} />
                </Td>
                <Td className="px-4 py-3 text-xs text-gray-400">
                  {format(new Date(blog.created_at), 'MMM d, yyyy')}
                </Td>
                <Td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(blog)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handlePublish(blog)}
                      className={`p-1.5 rounded-md transition-colors ${
                        blog.status === 'PUBLISHED'
                          ? 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'
                          : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={blog.status === 'PUBLISHED' ? 'Revert to Draft' : 'Publish'}
                    >
                      {blog.status === 'PUBLISHED' ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(blog.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Editor modal */}
      {modal && <EditorModal initial={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
