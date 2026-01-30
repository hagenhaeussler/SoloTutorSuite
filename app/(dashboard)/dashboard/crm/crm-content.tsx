'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { Users, Plus, Loader2 } from 'lucide-react'
import type { Lead } from '@/lib/types'
import { addLeadAction, updateLeadAction, deleteLeadAction } from './actions'
import { formatDate } from '@/lib/utils'

const STAGES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'booked', label: 'Booked', color: 'bg-purple-100 text-purple-800' },
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', color: 'bg-gray-100 text-gray-800' },
]

interface CRMContentProps {
  leads: Lead[]
}

export function CRMContent({ leads }: CRMContentProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<{
    name: string
    email: string
    phone: string
    source: string
    stage: 'new' | 'contacted' | 'booked' | 'won' | 'lost'
    notes: string
    next_follow_up_date: string
  }>({
    name: '',
    email: '',
    phone: '',
    source: '',
    stage: 'new',
    notes: '',
    next_follow_up_date: '',
  })
  const { toast } = useToast()
  const router = useRouter()

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      source: '',
      stage: 'new',
      notes: '',
      next_follow_up_date: '',
    })
    setEditingLead(null)
  }

  const openEdit = (lead: Lead) => {
    setEditingLead(lead)
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || '',
      stage: lead.stage,
      notes: lead.notes || '',
      next_follow_up_date: lead.next_follow_up_date || '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      if (editingLead) {
        const result = await updateLeadAction(editingLead.id, formData)
        if (result.error) throw new Error(result.error)
        toast({ title: 'Lead updated!' })
      } else {
        const result = await addLeadAction(formData)
        if (result.error) throw new Error(result.error)
        toast({ title: 'Lead added!' })
      }
      setDialogOpen(false)
      resetForm()
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    try {
      await deleteLeadAction(id)
      toast({ title: 'Lead deleted' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleStageChange = async (lead: Lead, newStage: string) => {
    try {
      await updateLeadAction(lead.id, { ...lead, stage: newStage as any })
      toast({ title: 'Stage updated' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const getStageColor = (stage: string) => {
    return STAGES.find(s => s.value === stage)?.color || 'bg-gray-100'
  }

  const leadsByStage = STAGES.reduce((acc, stage) => {
    acc[stage.value] = leads.filter(l => l.stage === stage.value)
    return acc
  }, {} as Record<string, Lead[]>)

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">CRM</h1>
          <p className="text-muted-foreground">
            Track and manage your leads through the pipeline
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Lead name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Source</Label>
                  <Input
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    placeholder="e.g., LinkedIn, Referral"
                  />
                </div>
                <div>
                  <Label>Stage</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(v) => setFormData({ ...formData, stage: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Next Follow-up</Label>
                <Input
                  type="date"
                  value={formData.next_follow_up_date}
                  onChange={(e) => setFormData({ ...formData, next_follow_up_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any notes about this lead..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                {editingLead && (
                  <Button variant="destructive" onClick={() => handleDelete(editingLead.id)}>
                    Delete
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingLead ? 'Save Changes' : 'Add Lead'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {STAGES.map(stage => (
          <Card key={stage.value}>
            <CardContent className="py-4">
              <p className="text-2xl font-bold">{leadsByStage[stage.value]?.length || 0}</p>
              <p className="text-sm text-muted-foreground">{stage.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Board */}
      <div className="grid grid-cols-5 gap-4">
        {STAGES.map(stage => (
          <div key={stage.value}>
            <div className={`p-2 rounded-t-lg ${stage.color} font-medium text-sm text-center`}>
              {stage.label} ({leadsByStage[stage.value]?.length || 0})
            </div>
            <div className="bg-gray-50 rounded-b-lg p-2 min-h-[300px] space-y-2">
              {leadsByStage[stage.value]?.map(lead => (
                <Card 
                  key={lead.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openEdit(lead)}
                >
                  <CardContent className="p-3">
                    <p className="font-medium truncate">{lead.name}</p>
                    {lead.email && (
                      <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                    )}
                    {lead.source && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {lead.source}
                      </Badge>
                    )}
                    {lead.next_follow_up_date && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Follow up: {formatDate(lead.next_follow_up_date)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
