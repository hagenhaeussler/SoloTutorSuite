'use client'

import { useState, useRef } from 'react'
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
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Copy, Upload, FileText, ClipboardList, Loader2, Plus, Trash2, Download, Check, Video, Save, MessageSquare, Send, BarChart3, Link2 } from 'lucide-react'
import type { Student, StudentFile, Homework, HomeworkSubmission, StudentChatMessage, LessonNote, ProgressMilestone, ProgressShareLink } from '@/lib/types'
import { uploadFileAction, deleteFileAction, getSignedUrlAction, addHomeworkAction, deleteHomeworkAction, deleteStudentAction, updateStudentZoomLinkAction, sendTutorChatMessageAction, addLessonNoteAction, addProgressMilestoneAction, createProgressShareLinkAction, revokeProgressShareLinkAction } from '../actions'
import { formatDate } from '@/lib/utils'

interface StudentDetailContentProps {
  student: Student
  files: StudentFile[]
  homework: Homework[]
  submissions: HomeworkSubmission[]
  chatMessages: StudentChatMessage[]
  lessonNotes: LessonNote[]
  milestones: ProgressMilestone[]
  shareLinks: ProgressShareLink[]
}

export function StudentDetailContent({ student, files, homework, submissions, chatMessages, lessonNotes, milestones, shareLinks }: StudentDetailContentProps) {
  const [uploading, setUploading] = useState(false)
  const [hwDialogOpen, setHwDialogOpen] = useState(false)
  const [hwLoading, setHwLoading] = useState(false)
  const [zoomSaving, setZoomSaving] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [progressLoading, setProgressLoading] = useState(false)
  const [milestoneLoading, setMilestoneLoading] = useState(false)
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  const copyLink = () => {
    const url = `${window.location.origin}/student/${student.access_token}`
    navigator.clipboard.writeText(url)
    toast({ title: 'Student portal link copied!' })
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
        <Button variant="outline" onClick={copyLink}>
          <Copy className="w-4 h-4 mr-2" />
          Copy Portal Link
        </Button>
        <Button variant="destructive" onClick={handleDeleteStudent}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground mb-2">Student Portal Link:</p>
          <code className="text-sm bg-gray-100 px-2 py-1 rounded block overflow-x-auto">
            {typeof window !== 'undefined' ? window.location.origin : ''}/student/{student.access_token}
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Share this link with the student to access their files and submit homework
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Video Call (Zoom)
          </CardTitle>
          <CardDescription>
            Add a Zoom meeting link so both you and the student can join from inside the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              value={zoomMeetingLink}
              onChange={(e) => setZoomMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/1234567890"
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
                  Join Zoom
                </a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Leave blank and save to remove the Zoom link.
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
              <CardDescription>Send messages directly inside Solo Tutor Suite.</CardDescription>
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
                    milestones.map((m) => (
                      <div key={m.id} className="p-3 bg-gray-50 rounded-lg flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{m.title}</p>
                          {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
                        </div>
                        <Badge variant={m.status === 'achieved' ? 'success' : 'secondary'}>{m.status}</Badge>
                      </div>
                    ))
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
