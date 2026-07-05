'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Upload, X, ImageIcon, CheckCircle2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCategories } from '@/services/marketplace/marketplace.hooks';
import { useAdminCreateProduct } from '@/services/admin/admin-inventory.hooks';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variant {
  variant_name: string;
  sku: string;
  price_modifier: string;
  quantity_available: string;
  low_stock_threshold: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-700">
        {label} {required && <span className="text-[#E03E3E]">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 focus:border-[#E03E3E]/50 transition-colors ${className}`}
      {...props}
    />
  );
}

function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 focus:border-[#E03E3E]/50 transition-colors resize-none ${className}`}
      {...props}
    />
  );
}

function Select({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 focus:border-[#E03E3E]/50 transition-colors bg-white ${className}`}
      {...props}
    />
  );
}

// ─── Image Upload Zone ────────────────────────────────────────────────────────

function ImageUploadZone({
  images,
  onAdd,
  onRemove,
}: {
  images: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 5 - images.length);
    if (valid.length) onAdd(valid);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          dragging ? 'border-[#E03E3E] bg-red-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <Upload className="w-5 h-5 text-gray-400" />
        <p className="text-sm text-gray-500 font-medium">Drop images here or <span className="text-[#E03E3E]">browse</span></p>
        <p className="text-xs text-gray-400">PNG, JPG, WEBP — up to 5 images</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Previews */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((file, i) => (
            <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border border-gray-200 flex-shrink-0">
              <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-black/50 text-white py-0.5">Cover</span>
              )}
            </div>
          ))}
          {images.length < 5 && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-20 h-20 rounded-md border-2 border-dashed border-gray-200 flex items-center justify-center hover:border-gray-300 transition-colors"
            >
              <Plus className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Variant Row ──────────────────────────────────────────────────────────────

function VariantRow({
  variant,
  index,
  onChange,
  onRemove,
}: {
  variant: Variant;
  index: number;
  onChange: (index: number, field: keyof Variant, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex gap-2 items-start p-3 bg-gray-50 rounded-md border border-gray-100">
      <div className="grid grid-cols-5 gap-2 flex-1">
        <Field label="Variant Name" required>
          <Input
            placeholder="e.g. 30 Capsules"
            value={variant.variant_name}
            onChange={(e) => onChange(index, 'variant_name', e.target.value)}
          />
        </Field>
        <Field label="SKU" hint="Optional">
          <Input
            placeholder="e.g. SKU-001"
            value={variant.sku}
            onChange={(e) => onChange(index, 'sku', e.target.value)}
          />
        </Field>
        <Field label="Price Modifier (₦)" hint="+/- from base">
          <Input
            type="number"
            placeholder="0"
            value={variant.price_modifier}
            onChange={(e) => onChange(index, 'price_modifier', e.target.value)}
          />
        </Field>
        <Field label="Stock Qty">
          <Input
            type="number"
            min="0"
            placeholder="0"
            value={variant.quantity_available}
            onChange={(e) => onChange(index, 'quantity_available', e.target.value)}
          />
        </Field>
        <Field label="Low Stock At">
          <Input
            type="number"
            min="1"
            placeholder="5"
            value={variant.low_stock_threshold}
            onChange={(e) => onChange(index, 'low_stock_threshold', e.target.value)}
          />
        </Field>
      </div>
      <button type="button" onClick={() => onRemove(index)} className="mt-5 text-gray-400 hover:text-red-500 transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const emptyVariant = (): Variant => ({
  variant_name: '', sku: '', price_modifier: '0',
  quantity_available: '0', low_stock_threshold: '5',
});

export default function AddNewProductPage() {
  const router = useRouter();
  const { data: categories = [] } = useCategories();
  const { mutate: createProduct, isPending } = useAdminCreateProduct();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [stockQty, setStockQty] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [images, setImages] = useState<File[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Product name is required';
    if (!description.trim()) e.description = 'Description is required';
    if (!categoryId) e.categoryId = 'Please select a category';
    if (!price || isNaN(Number(price)) || Number(price) <= 0) e.price = 'Enter a valid price';
    if (!stockQty || isNaN(Number(stockQty)) || Number(stockQty) < 0) e.stockQty = 'Enter a valid stock quantity';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('description', description.trim());
    formData.append('category_id', categoryId);
    formData.append('price', price);
    formData.append('quantity_available', stockQty);
    formData.append('low_stock_threshold', lowStockThreshold);

    images.forEach((file, i) => formData.append(`image_${i}`, file));

    if (variants.length > 0) {
      formData.append('variants', JSON.stringify(variants));
    }

    createProduct(formData, {
      onSuccess: () => {
        setSuccessMsg('Product created successfully!');
        setShowToast(true);
        setTimeout(() => router.push('/admin/inventory'), 1800);
      },
      onError: () => setErrors({ submit: 'Failed to create product. Please try again.' }),
    });
  }

  function updateVariant(index: number, field: keyof Variant, value: string) {
    setVariants((prev) => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  }

  return (
    <div className="p-6 max-w-3xl flex flex-col gap-6">
      {/* Toast */}
      {showToast && (
        <div className="fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-md shadow-lg bg-green-600 text-white text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Product created successfully! Redirecting…
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/inventory" className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fill in the details to add a product to inventory</p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3 text-sm text-green-700 font-medium">
          {successMsg}
        </div>
      )}
      {errors.submit && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-[#E03E3E] font-medium">
          {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Basic Info */}
        <Card className="rounded-md border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-900">Basic Information</h2>

          <Field label="Product Name" required>
            <Input
              placeholder="e.g. Oakley Prizm Sunglasses"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <p className="text-xs text-[#E03E3E] mt-0.5">{errors.name}</p>}
          </Field>

          <Field label="Description" required>
            <Textarea
              rows={4}
              placeholder="Describe the product — what it is, what it does, who it's for…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <p className="text-xs text-[#E03E3E] mt-0.5">{errors.description}</p>}
          </Field>

          <Field label="Category" required>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            {errors.categoryId && <p className="text-xs text-[#E03E3E] mt-0.5">{errors.categoryId}</p>}
          </Field>
        </Card>

        {/* Pricing & Stock */}
        <Card className="rounded-md border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-gray-900">Pricing & Stock</h2>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Price (₦)" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              {errors.price && <p className="text-xs text-[#E03E3E] mt-0.5">{errors.price}</p>}
            </Field>

            <Field label="Initial Stock Qty" required>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
              {errors.stockQty && <p className="text-xs text-[#E03E3E] mt-0.5">{errors.stockQty}</p>}
            </Field>

            <Field label="Low Stock Alert At" hint="Trigger alert below this qty">
              <Input
                type="number"
                min="1"
                placeholder="5"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        {/* Images */}
        <Card className="rounded-md border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Product Images</h2>
            <p className="text-xs text-gray-400 mt-0.5">First image will be used as the cover. Up to 5 images.</p>
          </div>
          <ImageUploadZone
            images={images}
            onAdd={(files) => setImages((prev) => [...prev, ...files].slice(0, 5))}
            onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
          />
          {images.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>No images added — product will show a placeholder icon</span>
            </div>
          )}
        </Card>

        {/* Variants */}
        <Card className="rounded-md border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Product Variants</h2>
              <p className="text-xs text-gray-400 mt-0.5">Optional — add variants like sizes, pack quantities, or colours</p>
            </div>
            <button
              type="button"
              onClick={() => setVariants((prev) => [...prev, emptyVariant()])}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#E03E3E] hover:text-[#c93535] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Variant
            </button>
          </div>

          {variants.length === 0 ? (
            <p className="text-xs text-gray-400">No variants added. This product will be sold as a single item.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {variants.map((v, i) => (
                <VariantRow
                  key={i}
                  variant={v}
                  index={i}
                  onChange={updateVariant}
                  onRemove={(idx) => setVariants((prev) => prev.filter((_, j) => j !== idx))}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <Link
            href="/admin/inventory"
            className="px-5 py-2.5 rounded-md border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#E03E3E] text-white text-sm font-semibold hover:bg-[#c93535] disabled:opacity-60 transition-colors"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? 'Creating…' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
}
