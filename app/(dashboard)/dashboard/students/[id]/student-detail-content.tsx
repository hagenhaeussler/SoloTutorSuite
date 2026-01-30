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
import { ArrowLeft, Copy, Upload, FileText, ClipboardList, Loader2, Plus, Trash2, Download, Check } from 'lucide-react'
import type { Student, StudentFile, Homework, HomeworkSubmission } from '@/lib/types'
import { uploadFileAction, deleteFileAction, getSignedUrlAction, addHomeworkAction, deleteHomeworkAction, deleteStudentAction } from '../actions'
import { formatDate } from '@/lib/utils'

interface StudentDetailContentProps {
  student: Student
  files: StudentFile[]
  homework: Homework[]
  submissions: HomeworkSubmission[]
}

export function StudentDetailContent({ student, files, homework, submissions }: StudentDetailContentProps) {
  const [uploading, setUploading] = useState(false)
  const [hwDialogOpen, setHwDialogOpen] = useState(false)
  const [hwLoading, setHwLoading] = useState(false)
  const [hwTitle, setHwTitle] = useState('')
  const [hwInstructions, setHwInstructions] = useState('')
  const [hwDueDate, setHwDueDate] = useState('')
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

  const getSubmissionForHomework = (homeworkId: string) => {
    return submissions.find(s => s.homework_id === homeworkId)
  }

  const downloadSubmission = async (storagePath: string) => {
    const result = await getSignedUrlAction(storagePath)
    if (result.url) window.open(result.url, '_blank')
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
      </Tabs>
    </div>
  )
}
