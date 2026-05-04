'use client'

import { useMemo, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Copy, Upload, FileText, ClipboardList, Loader2, Plus, Trash2, Download, Check, Video, Save, MessageSquare, Send, BarChart3, Link2, CheckCircle2, CreditCard } from 'lucide-react'
import type { Student, StudentFile, Homework, HomeworkSubmission, StudentChatMessage, LessonNote, ProgressMilestone, ProgressShareLink, MockSubscription } from '@/lib/types'
import { uploadFileAction, deleteFileAction, getSignedUrlAction, addHomeworkAction, deleteHomeworkAction, deleteStudentAction, updateStudentZoomLinkAction, sendTutorChatMessageAction, addLessonNoteAction, addProgressMilestoneAction, toggleProgressMilestoneAction, offerMockSubscriptionAction, cancelMockSubscriptionAction, createProgressShareLinkAction, revokeProgressShareLinkAction } from '../actions'
import { cn, formatDate } from '@/lib/utils'

interface StudentDetailContentProps {
  student: Student
  files: StudentFile[]
  homework: Homework[]
  submissions: HomeworkSubmission[]
  chatMessages: StudentChatMessage[]
  lessonNotes: LessonNote[]
  milestones: ProgressMilestone[]
  shareLinks: ProgressShareLink[]
  subscriptions: MockSubscription[]
}

export function StudentDetailContent({ student, files, homework, submissions, chatMessages, lessonNotes, milestones, shareLinks, subscriptions }: StudentDetailContentProps) {
  const [uploading, setUploading] = useState(false)
  const [hwDialogOpen, setHwDialogOpen] = useState(false)
  const [hwLoading, setHwLoading] = useState(false)
  const [zoomSaving, setZoomSaving] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [progressLoading, setProgressLoading] = useState(false)
  const [milestoneLoading, setMilestoneLoading] = useState(false)
  const [milestoneUpdatingId, setMilestoneUpdatingId] = useState<string | null>(null)
  const [celebratingMilestoneId, setCelebratingMilestoneId] = useState<string | null>(null)
  const [optimisticMilestoneStatuses, setOptimisticMilestoneStatuses] = useState<Record<string, ProgressMilestone['status']>>({})
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionUpdatingId, setSubscriptionUpdatingId] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [hwTitle, setHwTitle] = useState('')
  const [hwInstructions, setHwInstructions] = useState('')
  const [hwDueDate, setHwDueDate] = useState('')
  const [zoomMeetingLink, setZoomMeetingLink] = useState(student.zoom_meeting_link || '')
  const [chatText, setChatText] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteSummary, setNoteSummary] = useState('')
  const [noteHomework, setNoteHomework] = useState('')
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDescription, setMilestoneDescription] = useState('')
  const [milestoneTargetDate, setMilestoneTargetDate] = useState('')
  const [subscriptionPlanName, setSubscriptionPlanName] = useState('')
  const [subscriptionDescription, setSubscriptionDescription] = useState('')
  const [subscriptionAmount, setSubscriptionAmount] = useState('')
  const [subscriptionInterval, setSubscriptionInterval] = useState<MockSubscription['billing_interval']>('monthly')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  const milestoneProgress = useMemo(() => {
    const achieved = milestones.filter((milestone) => {
      const status = optimisticMilestoneStatuses[milestone.id] ?? milestone.status
      return status === 'achieved'
    }).length
    const total = milestones.length

    return {
      achieved,
      total,
      percent: total > 0 ? Math.round((achieved / total) * 100) : 0,
    }
  }, [milestones, optimisticMilestoneStatuses])

  const getMilestoneStatus = (milestone: ProgressMilestone) => {
    return optimisticMilestoneStatuses[milestone.id] ?? milestone.status
  }

  const activeSubscriptionTotalCents = subscriptions
    .filter((subscription) => subscription.status === 'active')
    .reduce((sum, subscription) => sum + subscription.amount_cents, 0)

  const formatSubscriptionPrice = (subscription: MockSubscription) => {
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: subscription.currency || 'USD',
    }).format(subscription.amount_cents / 100)

    return `${amount}/${subscription.billing_interval.replace('ly', '')}`
  }

  const copySignupLink = () => {
    const url = `${window.location.origin}/login?role=student`
    navigator.clipboard.writeText(url)
    toast({ title: 'Student signup link copied!' })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('studentId', student.id)

      const result = await uploadFileAction(formData)
      if (result.error) throw new Error(result.error)

      toast({ title: 'File uploaded!' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownload = async (file: StudentFile) => {
    try {
      const result = await getSignedUrlAction(file.storage_path)
      if (result.error) throw new Error(result.error)
      window.open(result.url, '_blank')
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleDeleteFile = async (file: StudentFile) => {
    if (!confirm('Delete this file?')) return
    try {
      await deleteFileAction(file.id, file.storage_path)
      toast({ title: 'File deleted' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleAddHomework = async () => {
    if (!hwTitle) {
      toast({ title: 'Title is required', variant: 'destructive' })
      return
    }
    setHwLoading(true)
    try {
      const result = await addHomeworkAction({
        student_id: student.id,
        title: hwTitle,
        instructions: hwInstructions,
        due_date: hwDueDate,
      })
      if (result.error) throw new Error(result.error)
      toast({ title: 'Homework assigned!' })
      setHwDialogOpen(false)
      setHwTitle('')
      setHwInstructions('')
      setHwDueDate('')
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setHwLoading(false)
    }
  }

  const handleDeleteHomework = async (id: string) => {
    if (!confirm('Delete this homework?')) return
    try {
      await deleteHomeworkAction(id)
      toast({ title: 'Homework deleted' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleDeleteStudent = async () => {
    if (!confirm('Delete this student and all their files/homework?')) return
    try {
      await deleteStudentAction(student.id)
      toast({ title: 'Student deleted' })
      router.push('/dashboard/students')
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleSaveZoomLink = async () => {
    setZoomSaving(true)
    try {
      const result = await updateStudentZoomLinkAction(student.id, zoomMeetingLink)
      if (result.error) throw new Error(result.error)
      toast({ title: 'Video call link saved' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setZoomSaving(false)
    }
  }

  const getSubmissionForHomework = (homeworkId: string) => {
    return submissions.find(s => s.homework_id === homeworkId)
  }

  const downloadSubmission = async (storagePath: string) => {
    const result = await getSignedUrlAction(storagePath)
    if (result.url) window.open(result.url, '_blank')
  }

  const handleSendMessage = async () => {
    if (!chatText.trim()) return
    setChatSending(true)
    try {
      const result = await sendTutorChatMessageAction(student.id, chatText)
      if (result.error) throw new Error(result.error)
      setChatText('')
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setChatSending(false)
    }
  }

  const handleAddLessonNote = async () => {
    if (!noteTitle.trim()) {
      toast({ title: 'Lesson note title is required', variant: 'destructive' })
      return
    }

    setProgressLoading(true)
    try {
      const result = await addLessonNoteAction({
        student_id: student.id,
        lesson_date: noteDate,
        title: noteTitle,
        summary: noteSummary,
        homework_assigned: noteHomework,
        visibility_scope: 'shared',
      })
      if (result.error) throw new Error(result.error)

      setNoteTitle('')
      setNoteSummary('')
      setNoteHomework('')
      toast({ title: 'Lesson note added' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setProgressLoading(false)
    }
  }

  const handleAddMilestone = async () => {
    if (!milestoneTitle.trim()) {
      toast({ title: 'Milestone title is required', variant: 'destructive' })
      return
    }

    setMilestoneLoading(true)
    try {
      const result = await addProgressMilestoneAction({
        student_id: student.id,
        title: milestoneTitle,
        description: milestoneDescription,
        target_date: milestoneTargetDate,
        status: 'pending',
        visible_to_student: true,
      })
      if (result.error) throw new Error(result.error)

      setMilestoneTitle('')
      setMilestoneDescription('')
      setMilestoneTargetDate('')
      toast({ title: 'Milestone added' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setMilestoneLoading(false)
    }
  }

  const handleToggleMilestone = async (milestone: ProgressMilestone) => {
    const currentStatus = getMilestoneStatus(milestone)
    const nextStatus: ProgressMilestone['status'] = currentStatus === 'achieved' ? 'pending' : 'achieved'

    setMilestoneUpdatingId(milestone.id)
    setOptimisticMilestoneStatuses((current) => ({
      ...current,
      [milestone.id]: nextStatus,
    }))

    if (nextStatus === 'achieved') {
      setCelebratingMilestoneId(milestone.id)
      window.setTimeout(() => {
        setCelebratingMilestoneId((current) => (current === milestone.id ? null : current))
      }, 900)
    }

    try {
      const result = await toggleProgressMilestoneAction(milestone.id, nextStatus === 'achieved')
      if (result.error) throw new Error(result.error)

      toast({ title: nextStatus === 'achieved' ? 'Milestone accomplished!' : 'Milestone reopened' })
      router.refresh()
    } catch (error: any) {
      setOptimisticMilestoneStatuses((current) => {
        const next = { ...current }
        delete next[milestone.id]
        return next
      })
      setCelebratingMilestoneId(null)
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setMilestoneUpdatingId(null)
    }
  }

  const handleOfferSubscription = async () => {
    if (!subscriptionPlanName.trim()) {
      toast({ title: 'Plan name is required', variant: 'destructive' })
      return
    }

    const amountDollars = Number(subscriptionAmount)
    if (!Number.isFinite(amountDollars) || amountDollars < 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' })
      return
    }

    setSubscriptionLoading(true)
    try {
      const result = await offerMockSubscriptionAction({
        student_id: student.id,
        plan_name: subscriptionPlanName,
        description: subscriptionDescription,
        amount_dollars: amountDollars,
        billing_interval: subscriptionInterval,
      })
      if (result.error) throw new Error(result.error)

      setSubscriptionPlanName('')
      setSubscriptionDescription('')
      setSubscriptionAmount('')
      setSubscriptionInterval('monthly')
      toast({ title: 'Subscription offered', description: 'The student can now buy this mock subscription.' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSubscriptionLoading(false)
    }
  }

  const handleCancelSubscription = async (subscription: MockSubscription) => {
    if (!confirm('Cancel this mock subscription?')) return

    setSubscriptionUpdatingId(subscription.id)
    try {
      const result = await cancelMockSubscriptionAction(subscription.id)
      if (result.error) throw new Error(result.error)

      toast({ title: 'Subscription cancelled' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSubscriptionUpdatingId(null)
    }
  }

  const handleCreateShareLink = async () => {
    setShareLoading(true)
    try {
      const result = await createProgressShareLinkAction({
        student_id: student.id,
        expires_in_days: 60,
      })
      if (result.error) throw new Error(result.error)

      const url = `${window.location.origin}/progress/${result.token}`
      await navigator.clipboard.writeText(url)
      toast({ title: 'Share link created and copied!' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setShareLoading(false)
    }
  }

  const handleRevokeShareLink = async (linkId: string) => {
    try {
      const result = await revokeProgressShareLinkAction(linkId)
      if (result.error) throw new Error(result.error)
      toast({ title: 'Share link revoked' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/students">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{student.name}</h1>
          {student.email && (
            <p className="text-muted-foreground">{student.email}</p>
          )}
        </div>
        <Button variant="outline" onClick={copySignupLink}>
          <Copy className="w-4 h-4 mr-2" />
          Copy Signup Link
        </Button>
        <Button variant="destructive" onClick={handleDeleteStudent}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Student Account Connection</p>
            {student.invitation_status === 'active' && student.auth_user_id && (
              <Badge variant="success">accepted</Badge>
            )}
            {student.invitation_status === 'pending' && (
              <Badge variant="warning">invite pending</Badge>
            )}
            {student.invitation_status === 'declined' && (
              <Badge variant="destructive">declined</Badge>
            )}
            {!student.auth_user_id && (
              <Badge variant="outline">not signed up</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">Student Google signup link:</p>
          <code className="text-sm bg-gray-100 px-2 py-1 rounded block overflow-x-auto">
            {typeof window !== 'undefined' ? window.location.origin : ''}/login?role=student
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Ask the student to sign in with the same Google email shown on this profile. After you invite that email, they must accept from their student dashboard before tutor-shared files, homework, plans, notes, progress, chat, and video links appear.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Video Call Link
          </CardTitle>
          <CardDescription>
            Save a meeting link (Zoom, Google Meet, Teams…) so both you and the student can join from inside the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              value={zoomMeetingLink}
              onChange={(e) => setZoomMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/... or meet.google.com/..."
            />
            <Button onClick={handleSaveZoomLink} disabled={zoomSaving}>
              {zoomSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Link
            </Button>
            {student.zoom_meeting_link && (
              <Button variant="outline" asChild>
                <a href={student.zoom_meeting_link} target="_blank" rel="noopener noreferrer">
                  <Video className="w-4 h-4 mr-2" />
                  Join Call
                </a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Leave blank and save to remove the link.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="files">
        <TabsList className="mb-6">
          <TabsTrigger value="files" className="gap-2">
            <FileText className="w-4 h-4" />
            Files ({files.length})
          </TabsTrigger>
          <TabsTrigger value="homework" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Homework ({homework.length})
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="financials" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Financials
          </TabsTrigger>
          <TabsTrigger value="progress" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Files</CardTitle>
                <CardDescription>Documents shared with this student</CardDescription>
              </div>
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload File
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No files uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.uploaded_by === 'student' ? 'Uploaded by student · ' : ''}{formatDate(file.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(file)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteFile(file)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="homework">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Homework</CardTitle>
                <CardDescription>Assignments for this student</CardDescription>
              </div>
              <Dialog open={hwDialogOpen} onOpenChange={setHwDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="w-4 h-4 mr-2" />Assign Homework</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Assign Homework</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Title *</Label>
                      <Input value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} placeholder="e.g., Chapter 5 Problems" />
                    </div>
                    <div>
                      <Label>Instructions</Label>
                      <Textarea value={hwInstructions} onChange={(e) => setHwInstructions(e.target.value)} placeholder="Describe what the student should do..." rows={3} />
                    </div>
                    <div>
                      <Label>Due Date</Label>
                      <Input type="date" value={hwDueDate} onChange={(e) => setHwDueDate(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setHwDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddHomework} disabled={hwLoading}>
                        {hwLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Assign
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {homework.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No homework assigned yet</p>
              ) : (
                <div className="space-y-3">
                  {homework.map((hw) => {
                    const submission = getSubmissionForHomework(hw.id)
                    return (
                      <div key={hw.id} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{hw.title}</p>
                              {submission ? (
                                <Badge variant="success" className="gap-1"><Check className="w-3 h-3" />Submitted</Badge>
                              ) : hw.due_date && new Date(hw.due_date) < new Date() ? (
                                <Badge variant="destructive">Overdue</Badge>
                              ) : (
                                <Badge variant="secondary">Pending</Badge>
                              )}
                            </div>
                            {hw.instructions && <p className="text-sm text-muted-foreground mt-1">{hw.instructions}</p>}
                            {hw.due_date && <p className="text-xs text-muted-foreground mt-2">Due: {formatDate(hw.due_date)}</p>}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteHomework(hw.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                        {submission && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Submission:</p>
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{submission.filename}</span>
                              <Button variant="ghost" size="sm" onClick={() => downloadSubmission(submission.storage_path)}>
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Chat with Student</CardTitle>
              <CardDescription>Send messages directly inside SoloTutorSuite.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[420px] overflow-y-auto mb-4">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation below.</p>
                ) : (
                  chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_type === 'tutor' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          message.sender_type === 'tutor'
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p>{message.message}</p>
                        <p className={`text-[10px] mt-1 ${message.sender_type === 'tutor' ? 'text-blue-100' : 'text-muted-foreground'}`}>
                          {formatDate(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <Button onClick={handleSendMessage} disabled={chatSending || !chatText.trim()}>
                  {chatSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financials">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mock Subscription Offer</CardTitle>
                <CardDescription>
                  Offer a simulated subscription. No payment processor is connected.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>Plan name</Label>
                    <Input
                      value={subscriptionPlanName}
                      onChange={(e) => setSubscriptionPlanName(e.target.value)}
                      placeholder="e.g., Weekly coaching plan"
                    />
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={subscriptionAmount}
                      onChange={(e) => setSubscriptionAmount(e.target.value)}
                      placeholder="150"
                    />
                  </div>
                </div>
                <div>
                  <Label>Billing interval</Label>
                  <Select value={subscriptionInterval} onValueChange={(value) => setSubscriptionInterval(value as MockSubscription['billing_interval'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={subscriptionDescription}
                    onChange={(e) => setSubscriptionDescription(e.target.value)}
                    placeholder="What is included in this subscription?"
                    rows={3}
                  />
                </div>
                <Button onClick={handleOfferSubscription} disabled={subscriptionLoading}>
                  {subscriptionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Offer Subscription
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscriptions</CardTitle>
                <CardDescription>View and cancel this student&apos;s mock subscription history.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground mb-2">Active mock subscriptions</p>
                  <p className="text-2xl font-bold">${(activeSubscriptionTotalCents / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Simulated recurring total for this student.</p>
                </div>

                {subscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No subscriptions offered yet.</p>
                ) : (
                  <div className="space-y-3">
                    {subscriptions.map((subscription) => {
                      const updating = subscriptionUpdatingId === subscription.id

                      return (
                        <div key={subscription.id} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{subscription.plan_name}</p>
                                <Badge variant={subscription.status === 'active' ? 'success' : subscription.status === 'offered' ? 'secondary' : 'outline'}>
                                  {subscription.status}
                                </Badge>
                              </div>
                              {subscription.description && (
                                <p className="text-sm text-muted-foreground mt-1">{subscription.description}</p>
                              )}
                              <p className="text-sm font-semibold mt-2">{formatSubscriptionPrice(subscription)}</p>
                              {subscription.started_at && (
                                <p className="text-xs text-muted-foreground mt-1">Started {formatDate(subscription.started_at)}</p>
                              )}
                              {subscription.cancelled_at && (
                                <p className="text-xs text-muted-foreground mt-1">Cancelled {formatDate(subscription.cancelled_at)}</p>
                              )}
                            </div>
                            {subscription.status !== 'cancelled' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelSubscription(subscription)}
                                disabled={updating}
                              >
                                {updating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="progress">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  Shareable Progress Summary
                </CardTitle>
                <CardDescription>
                  Create a secure link for parents/students to view lessons, notes, homework, and milestones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleCreateShareLink} disabled={shareLoading}>
                  {shareLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create & Copy Share Link
                </Button>
                <div className="mt-4 space-y-2">
                  {shareLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No share links yet.</p>
                  ) : (
                    shareLinks.map((link) => {
                      const progressUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/progress/${link.token}`
                      const isRevoked = Boolean(link.revoked_at)
                      return (
                        <div key={link.id} className="p-3 border rounded-lg flex items-center justify-between gap-3">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded truncate">{progressUrl}</code>
                          <div className="flex items-center gap-2">
                            <Badge variant={isRevoked ? 'outline' : 'success'}>{isRevoked ? 'Revoked' : 'Active'}</Badge>
                            {!isRevoked && (
                              <Button variant="outline" size="sm" onClick={() => handleRevokeShareLink(link.id)}>
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Lesson Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Lesson date</Label>
                    <Input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g., Algebra session recap" />
                  </div>
                </div>
                <div>
                  <Label>Summary</Label>
                  <Textarea value={noteSummary} onChange={(e) => setNoteSummary(e.target.value)} rows={3} />
                </div>
                <div>
                  <Label>Homework assigned</Label>
                  <Textarea value={noteHomework} onChange={(e) => setNoteHomework(e.target.value)} rows={2} />
                </div>
                <Button onClick={handleAddLessonNote} disabled={progressLoading}>
                  {progressLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Lesson Note
                </Button>

                <div className="pt-2 space-y-2">
                  {lessonNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No lesson notes yet.</p>
                  ) : (
                    lessonNotes.map((note) => (
                      <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{note.title}</p>
                          <Badge variant="outline">{note.lesson_date}</Badge>
                        </div>
                        {note.summary && <p className="text-sm text-muted-foreground mt-1">{note.summary}</p>}
                        {note.homework_assigned && <p className="text-sm mt-2"><span className="font-medium">Homework:</span> {note.homework_assigned}</p>}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progress Milestones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {milestones.length > 0 && (
                  <div className="space-y-3 pb-2">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">Milestone Progress</p>
                        <p className="text-xs text-muted-foreground">
                          {milestoneProgress.achieved} of {milestoneProgress.total} accomplished
                        </p>
                      </div>
                      <Badge variant={milestoneProgress.percent === 100 ? 'success' : 'secondary'}>
                        {milestoneProgress.percent}%
                      </Badge>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn(
                          'h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-700',
                          celebratingMilestoneId && 'progress-fill-celebrate'
                        )}
                        style={{ width: `${milestoneProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>Milestone title</Label>
                    <Input value={milestoneTitle} onChange={(e) => setMilestoneTitle(e.target.value)} placeholder="e.g., Master quadratic equations" />
                  </div>
                  <div>
                    <Label>Target date</Label>
                    <Input type="date" value={milestoneTargetDate} onChange={(e) => setMilestoneTargetDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={milestoneDescription} onChange={(e) => setMilestoneDescription(e.target.value)} rows={3} />
                </div>
                <Button onClick={handleAddMilestone} disabled={milestoneLoading}>
                  {milestoneLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Milestone
                </Button>

                <div className="pt-2 space-y-2">
                  {milestones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No milestones yet.</p>
                  ) : (
                    milestones.map((m) => {
                      const status = getMilestoneStatus(m)
                      const achieved = status === 'achieved'
                      const updating = milestoneUpdatingId === m.id

                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'relative flex flex-col gap-3 overflow-hidden rounded-lg border p-3 transition-all sm:flex-row sm:items-start sm:justify-between',
                            achieved ? 'border-green-200 bg-green-50/70' : 'border-transparent bg-gray-50',
                            celebratingMilestoneId === m.id && 'milestone-achieved'
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{m.title}</p>
                              {m.target_date && <Badge variant="outline">Target {formatDate(m.target_date)}</Badge>}
                            </div>
                            {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <Badge variant={achieved ? 'success' : 'secondary'}>{achieved ? 'achieved' : status}</Badge>
                            <Button
                              size="sm"
                              variant={achieved ? 'outline' : 'default'}
                              className="gap-2"
                              onClick={() => handleToggleMilestone(m)}
                              disabled={updating}
                            >
                              {updating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              {achieved ? 'Reopen' : 'Mark Done'}
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
