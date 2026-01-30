'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { GraduationCap, FileText, ClipboardList, Download, Upload, Loader2, Check } from 'lucide-react'
import type { Student, StudentFile, Homework, HomeworkSubmission } from '@/lib/types'
import { downloadFileAction, uploadFileAction, submitHomeworkAction } from './actions'
import { formatDate } from '@/lib/utils'

interface StudentPortalContentProps {
  student: Student
  tutorName: string
  files: StudentFile[]
  homework: Homework[]
  submissions: HomeworkSubmission[]
  token: string
}

export function StudentPortalContent({
  student,
  tutorName,
  files,
  homework,
  submissions,
  token,
}: StudentPortalContentProps) {
  const [uploading, setUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedHomeworkId, setSelectedHomeworkId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const handleDownload = async (storagePath: string) => {
    try {
      const result = await downloadFileAction(storagePath, token)
      if (result.error) throw new Error(result.error)
      if (result.url) window.open(result.url, '_blank')
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedHomeworkId) return

    setUploading(selectedHomeworkId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('homeworkId', selectedHomeworkId)
      formData.append('token', token)

      const result = await submitHomeworkAction(formData)
      if (result.error) throw new Error(result.error)

      toast({ title: 'Homework submitted!' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setUploading(null)
      setSelectedHomeworkId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const getSubmissionForHomework = (homeworkId: string) => {
    return submissions.find(s => s.homework_id === homeworkId)
  }

  const triggerUpload = (homeworkId: string) => {
    setSelectedHomeworkId(homeworkId)
    fileInputRef.current?.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold">{student.name}&apos;s Portal</h1>
              <p className="text-sm text-muted-foreground">with {tutorName}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          <Tabs defaultValue="homework">
            <TabsList className="mb-6">
              <TabsTrigger value="homework" className="gap-2">
                <ClipboardList className="w-4 h-4" />
                Homework ({homework.length})
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-2">
                <FileText className="w-4 h-4" />
                Files ({files.length})
              </TabsTrigger>
            </TabsList>

            {/* Homework Tab */}
            <TabsContent value="homework">
              <Card>
                <CardHeader>
                  <CardTitle>Your Homework</CardTitle>
                  <CardDescription>
                    Assignments from your tutor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {homework.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No homework assigned yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {homework.map((hw) => {
                        const submission = getSubmissionForHomework(hw.id)
                        const isOverdue = hw.due_date && new Date(hw.due_date) < new Date() && !submission

                        return (
                          <div
                            key={hw.id}
                            className="p-4 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-medium">{hw.title}</h3>
                                  {submission ? (
                                    <Badge variant="success" className="gap-1">
                                      <Check className="w-3 h-3" />
                                      Submitted
                                    </Badge>
                                  ) : isOverdue ? (
                                    <Badge variant="destructive">Overdue</Badge>
                                  ) : (
                                    <Badge variant="secondary">Pending</Badge>
                                  )}
                                </div>
                                {hw.instructions && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    {hw.instructions}
                                  </p>
                                )}
                                {hw.due_date && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Due: {formatDate(hw.due_date)}
                                  </p>
                                )}
                              </div>
                              {!submission && (
                                <Button
                                  size="sm"
                                  onClick={() => triggerUpload(hw.id)}
                                  disabled={uploading === hw.id}
                                >
                                  {uploading === hw.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 mr-2" />
                                      Submit
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                            {submission && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs text-muted-foreground mb-1">
                                  Your submission:
                                </p>
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm">{submission.filename}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {formatDate(submission.submitted_at)}
                                  </Badge>
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

            {/* Files Tab */}
            <TabsContent value="files">
              <Card>
                <CardHeader>
                  <CardTitle>Shared Files</CardTitle>
                  <CardDescription>
                    Documents shared by your tutor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {files.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No files shared yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{file.filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(file.created_at)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file.storage_path)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
