"use client"

import { useEffect, useId, useRef, useState } from "react"
import { History } from "lucide-react"

export type SuggestionOption = {
  id: string
  label: string
  sublabel?: string
}

export default function SuggestingInput({
  label,
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder = "",
  required = false,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onSelect: (option: SuggestionOption) => void
  suggestions: SuggestionOption[]
  placeholder?: string
  required?: boolean
  hint?: string | null
}) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const showList = open && suggestions.length > 0 && value.trim().length > 0

  useEffect(() => {
    setActiveIndex(0)
  }, [suggestions, value])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  function selectOption(option: SuggestionOption) {
    onSelect(option)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && suggestions[activeIndex]) {
      e.preventDefault()
      selectOption(suggestions[activeIndex])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="chef-label" htmlFor={listId}>
        {label}
        {required && <span className="text-gold"> *</span>}
      </label>
      <input
        id={listId}
        type="text"
        required={required}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="chef-input"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
      />

      {hint && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-navy-light/80">
          <History size={12} className="shrink-0" strokeWidth={1.5} />
          {hint}
        </p>
      )}

      {showList && (
        <ul
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-stone-200/80 bg-surface py-1 shadow-card-lg"
          role="listbox"
        >
          {suggestions.map((option, index) => (
            <li key={option.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                className={`flex w-full flex-col items-start px-3 py-2.5 text-left transition ${
                  index === activeIndex ? "bg-navy/5" : "hover:bg-stone-50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectOption(option)
                }}
              >
                <span className="text-sm font-semibold text-charcoal">
                  {option.label}
                </span>
                {option.sublabel && (
                  <span className="mt-0.5 text-xs text-stone-500">
                    {option.sublabel}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
