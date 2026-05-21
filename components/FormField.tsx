"use client"

export default function FormField({
  label,
  placeholder = "",
  type = "text",
  value,
  onChange,
  required = false,
  min,
}: {
  label: string
  placeholder?: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  min?: string | number
}) {
  return (
    <div>
      <label className="chef-label">
        {label}
        {required && <span className="text-gold"> *</span>}
      </label>
      <input
        type={type}
        required={required}
        min={min}
        inputMode={type === "number" ? "numeric" : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        className="chef-input"
      />
    </div>
  )
}
