'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  GraduationCap,
  ClipboardList,
  FileText,
  MessageSquare,
  Calendar,
  CreditCard,
  Target,
  Upload,
  Loader2,
  Send,
  Video,
} from 'lucide-react'
import type { Homework, HomeworkSubmission, Student, StudentChatMessage, StudentFile, LessonNote, ProgressMilestone } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { sendStudentChatMessageAction, submitHomeworkByAuthAction } from './actions'

type StudentConnection = Pick<Student, 'id' | 'name' | 'email' | 'zoom_meeting_link'> & {
  tutorName: string
  tutorEmail: string | null
}

type StudentBooking = {
  id: string
  user_id: string
  start_ts: string
  end_ts: string
  prospect_name: string
  prospect_email: string
  status: 'confirmed' | 'cancelled'
}

interface StudentAppContentProps {
  studentName: string
  studentEmail: string | null
  studentInviteCode: string | null
  connections: StudentConnection[]
  homework: Homework[]
  files: StudentFile[]
  submissions: HomeworkSubmission[]
  bookings: StudentBooking[]
  chatMessages: StudentChatMessage[]
  lessonNotes: LessonNote[]
  milestones: ProgressMilestone[]
}

export function StudentAppContent({
  studentName,
  studentEmail,
  studentInviteCode,
  connections,
  homework,
  files,
  submissions,
  bookings,
  chatMessages,
  lessonNotes,
  milestones,
}: StudentAppContentProps) {
  const [selectedStudentId, setSelectedStudentId] = useState(connections[0]?.id || '')
  const [uploadingHomeworkId, setUploadingHomeworkId] = useState<string | null>(null)
  const [chatText, setChatText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingHomeworkId, setPendingHomeworkId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const selectedConnection = useMemo(
    () => connections.find((c) => c.id === selectedStudentId) || null,
    [connections, selectedStudentId]
  )

  const filteredHomework = useMemo(
    () => homework.filter((h) => h.student_id === selectedStudentId),
    [homework, selectedStudentId]
  )

  const filteredFiles = useMemo(
    () => files.filter((f) => f.student_id === selectedStudentId),
    [files, selectedStudentId]
  )

  const filteredSubmissions = useMemo(
    () => submissions.filter((s) => filteredHomework.some((h) => h.id === s.homework_id)),
    [submissions, filteredHomework]
  )

  const filteredChat = useMemo(
    () => chatMessages.filter((m) => m.student_id === selectedStudentId),
    [chatMessages, selectedStudentId]
  )

  const filteredBookings = useMemo(() => {
    if (!selectedConnection) return []

    const connectionEmail = selectedConnection.email?.toLowerCase()
    const profileEmail = studentEmail?.toLowerCase()

    return bookings.filter((b) => {
      const bookingEmail = b.prospect_email.toLowerCase()
      return bookingEmail === connectionEmail || bookingEmail === profileEmail
    })
  }, [bookings, selectedConnection, studentEmail])

  const filteredNotes = useMemo(
    () => lessonNotes.filter((n) => n.student_id === selectedStudentId),
    [lessonNotes, selectedStudentId]
  )

  const filteredMilestones = useMemo(
    () => milestones.filter((m) => m.student_id === selectedStudentId),
    [milestones, selectedStudentId]
  )

  const getSubmission = (homeworkId: string) => {
    return filteredSubmissions.find((s) => s.homework_id === homeworkId)
  }

  const triggerHomeworkUpload = (homeworkId: string) => {
    setPendingHomeworkId(homeworkId)
    fileInputRef.current?.click()
  }

  const handleHomeworkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingHomeworkId) return

    setUploadingHomeworkId(pendingHomeworkId)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('homeworkId', pendingHomeworkId)

      const result = await submitHomeworkByAuthAction(formData)
      if (result.error) throw new Error(result.error)

      toast({ title: 'Homework submitted!' })
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setUploadingHomeworkId(null)
      setPendingHomeworkId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSendMessage = async () => {
    if (!selectedStudentId || !chatText.trim()) return

    setChatSending(true)
    try {
      const result = await sendStudentChatMessageAction(selectedStudentId, chatText)
      if (result.error) throw new Error(result.error)
      setChatText('')
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setChatSending(false)
    }
  }

  const estimatedBillingCents = filteredBookings
    .filter((b) => b.status === 'confirmed')
    .length * 5000

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold">Student App</h1>
              <p className="text-sm text-muted-foreground">Welcome, {studentName}</p>
            </div>
          </div>
          <Badge variant="outline">ID: {studentInviteCode || 'Pending'}</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleHomeworkUpload} />

        {connections.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <h2 className="text-xl font-semibold mb-2">You&apos;re all set 🎉</h2>
              <p className="text-muted-foreground mb-3">
                Share your Student ID with your tutor so they can add you to their Students Hub.
              </p>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{studentInviteCode || 'Generating...'}</code>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Your Tutors</CardTitle>
                <CardDescription>Select a tutor workspace</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {connections.map((connection) => (
                    <Button
                      key={connection.id}
                      variant={selectedStudentId === connection.id ? 'default' : 'outline'}
                      onClick={() => setSelectedStudentId(connection.id)}
                    >
                      {connection.tutorName}
                    </Button>
                  ))}
                </div>
                {selectedConnection?.zoom_meeting_link && (
                  <Button className="mt-4" asChild>
                    <a href={selectedConnection.zoom_meeting_link} target="_blank" rel="noopener noreferrer">
                      <Video className="w-4 h-4 mr-2" />
                      Join Zoom Lesson
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="homework">
              <TabsList className="mb-6">
                <TabsTrigger value="homework" className="gap-2">
                  <ClipboardList className="w-4 h-4" /> Homework
                </TabsTrigger>
                <TabsTrigger value="files" className="gap-2">
                  <FileText className="w-4 h-4" /> Files
                </TabsTrigger>
                <TabsTrigger value="bookings" className="gap-2">
                  <Calendar className="w-4 h-4" /> Bookings
                </TabsTrigger>
                <TabsTrigger value="billing" className="gap-2">
                  <CreditCard className="w-4 h-4" /> Billing
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-2">
                  <MessageSquare className="w-4 h-4" /> Chat
                </TabsTrigger>
                <TabsTrigger value="progress" className="gap-2">
                  <Target className="w-4 h-4" /> Progress
                </TabsTrigger>
              </TabsList>

              <TabsContent value="homework">
                <Card>
                  <CardHeader>
                    <CardTitle>Homework</CardTitle>
                    <CardDescription>Complete and upload homework for your tutor.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredHomework.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No homework assigned yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {filteredHomework.map((hw) => {
                          const submission = getSubmission(hw.id)
                          return (
                            <div key={hw.id} className="p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{hw.title}</p>
                                  {hw.instructions && (
                                    <p className="text-sm text-muted-foreground mt-1">{hw.instructions}</p>
                                  )}
                                  {submission && (
                                    <Badge variant="success" className="mt-2">Submitted</Badge>
                                  )}
                                </div>
                                {!submission && (
                                  <Button
                                    size="sm"
                                    onClick={() => triggerHomeworkUpload(hw.id)}
                                    disabled={uploadingHomeworkId === hw.id}
                                  >
                                    {uploadingHomeworkId === hw.id ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <Upload className="w-4 h-4 mr-2" />
                                    )}
                                    Upload
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
              </TabsContent>

              <TabsContent value="files">
                <Card>
                  <CardHeader>
                    <CardTitle>Shared Files</CardTitle>
                    <CardDescription>Files shared with you by this tutor.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredFiles.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No files shared yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredFiles.map((file) => (
                          <div key={file.id} className="p-3 bg-gray-50 rounded-lg">
                            <p className="font-medium">{file.filename}</p>
                            <p className="text-xs text-muted-foreground">{formatDateTime(file.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bookings">
                <Card>
                  <CardHeader>
                    <CardTitle>Bookings</CardTitle>
                    <CardDescription>Upcoming and past sessions.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {filteredBookings.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No bookings found yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredBookings.map((booking) => (
                          <div key={booking.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{formatDateTime(booking.start_ts)}</p>
                              <Badge variant={booking.status === 'confirmed' ? 'secondary' : 'destructive'}>{booking.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="billing">
                <Card>
                  <CardHeader>
                    <CardTitle>Billing</CardTitle>
                    <CardDescription>Session-based billing summary.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">Estimated confirmed sessions total:</p>
                    <p className="text-2xl font-bold">${(estimatedBillingCents / 100).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      This reflects confirmed sessions in your booking history for the selected tutor.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="chat">
                <Card>
                  <CardHeader>
                    <CardTitle>Chat</CardTitle>
                    <CardDescription>Message your tutor directly.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[420px] overflow-y-auto mb-4">
                      {filteredChat.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
                      ) : (
                        filteredChat.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender_type === 'student' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                message.sender_type === 'student'
                                  ? 'bg-primary text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              <p>{message.message}</p>
                              <p className={`text-[10px] mt-1 ${message.sender_type === 'student' ? 'text-blue-100' : 'text-muted-foreground'}`}>
                                {formatDateTime(message.created_at)}
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
                <div className="grid lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Lesson Notes</CardTitle>
                      <CardDescription>Shared session recaps from your tutor.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredNotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No lesson notes yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {filteredNotes.map((note) => (
                            <div key={note.id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium">{note.title}</p>
                                <Badge variant="outline">{note.lesson_date}</Badge>
                              </div>
                              {note.summary && <p className="text-sm text-muted-foreground mt-2">{note.summary}</p>}
                              {note.homework_assigned && <p className="text-sm mt-2"><span className="font-medium">Homework:</span> {note.homework_assigned}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Milestones</CardTitle>
                      <CardDescription>Your current progress goals.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredMilestones.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No milestones yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {filteredMilestones.map((milestone) => (
                            <div key={milestone.id} className="p-3 bg-gray-50 rounded-lg flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{milestone.title}</p>
                                {milestone.description && <p className="text-sm text-muted-foreground mt-1">{milestone.description}</p>}
                              </div>
                              <Badge variant={milestone.status === 'achieved' ? 'success' : 'secondary'}>{milestone.status}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  )
}
