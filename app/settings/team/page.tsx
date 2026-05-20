"use client"

import { useState } from "react"
import Link from "next/link"
import AppShell from "@/components/AppShell"
import PageHeader from "@/components/PageHeader"
import StatusBadge from "@/components/StatusBadge"
import { mockHomes, mockHomeMembers } from "@/lib/mock-data"
import { ChevronLeft, Plus, X, Trash2 } from "lucide-react"

export default function TeamPage() {
  const [showInvite, setShowInvite] = useState(false)
  const [selectedHome, setSelectedHome] = useState(mockHomes[0].id)

  return (
    <AppShell>
      <Link
        href="/settings"
        className="mb-4 flex items-center gap-1.5 text-sm font-bold text-blue-600"
      >
        <ChevronLeft size={16} />
        Settings
      </Link>

      <PageHeader
        title="Team & Access"
        subtitle="Manage staff per residence"
        action={
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30"
          >
            <Plus size={15} />
            Invite
          </button>
        }
      />

      {mockHomes.map((home) => {
        const members = mockHomeMembers.filter((m) => m.home_id === home.id)
        return (
          <div key={home.id} className="mb-6">
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
              {home.name} · {home.location}
            </h2>

            {members.length === 0 ? (
              <div className="rounded-[22px] border border-[#E6EEF8] bg-white p-4 text-sm text-slate-400">
                No staff assigned.
              </div>
            ) : (
              <div className="rounded-[22px] border border-[#E6EEF8] bg-white overflow-hidden shadow-md shadow-slate-900/4">
                {members.map((member, i) => (
                  <div
                    key={member.id}
                    className={`
                      flex items-center justify-between px-5 py-4
                      ${i < members.length - 1 ? "border-b border-slate-100" : ""}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-extrabold text-slate-600">
                        {member.profile?.display_name[0] ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {member.profile?.display_name}
                        </p>
                        <p className="text-xs text-slate-400">{member.profile?.email}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {member.can_edit_pantry && (
                            <PermChip label="Edit Pantry" />
                          )}
                          {member.can_add_shopping_items && (
                            <PermChip label="Shopping" />
                          )}
                          {member.can_log_meals && (
                            <PermChip label="Log Meals" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge
                        label={member.role}
                        type={member.role === "admin" ? "blue" : member.role === "staff" ? "ok" : "low"}
                      />
                      {member.role !== "admin" && (
                        <button className="text-red-400">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-t-[32px] bg-white px-6 pt-6 pb-10 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900">Invite Staff</h2>
              <button
                onClick={() => setShowInvite(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <Field label="Email Address" placeholder="staff@email.com" type="email" />

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Residence
                </label>
                <select className="w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200">
                  {mockHomes.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Role
                </label>
                <div className="flex gap-2">
                  {["staff", "viewer"].map((r) => (
                    <button
                      key={r}
                      className="flex-1 capitalize rounded-xl border border-[#E6EEF8] py-2.5 text-xs font-bold text-slate-600"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Permissions
                </label>
                <div className="space-y-2">
                  {[
                    "Can edit pantry",
                    "Can add shopping items",
                    "Can log meals",
                  ].map((p) => (
                    <label key={p} className="flex items-center justify-between rounded-xl border border-[#E6EEF8] px-4 py-3">
                      <span className="text-sm text-slate-700">{p}</span>
                      <input type="checkbox" className="h-4 w-4 accent-blue-600" />
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowInvite(false)}
                className="w-full rounded-2xl bg-blue-600 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/30"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

function PermChip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
      {label}
    </span>
  )
}

function Field({
  label,
  placeholder,
  type = "text",
}: {
  label: string
  placeholder: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#E6EEF8] bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  )
}
