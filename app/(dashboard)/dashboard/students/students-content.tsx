'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { GraduationCap, Plus, Loader2, Copy, ExternalLink, Search, Mail } from 'lucide-react'
import type { Student } from '@/lib/types'
import { addStudentAction, inviteStudentByEmailAction } from './actions'
import { formatDate } from '@/lib/utils'

interface StudentsContentProps {
  students: Student[]
}

export function StudentsContent({ students }: StudentsContentProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [invitingByEmail, setInvitingByEmail] = useState(false)
  const [studentInviteEmail, setStudentInviteEmail] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Student['status']>('all')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [parentContact, setParentContact] = useState('')
  const [subjectExamType, setSubjectExamType] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<Student['status']>('active')
  const { toast } = useToast()
  const router = useRouter()

  const filteredStudents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return students.filter((student) => {
      const matchesStatus = statusFilter === 'all' || student.status === statusFilter
      const matchesQuery =
        normalizedQuery.length === 0 ||
        student.name.toLowerCase().includes(normalizedQuery) ||
        (student.email || '').toLowerCase().includes(normalizedQuery) ||
        (student.subject_exam_type || '').toLowerCase().includes(normalizedQuery) ||
        (student.parent_contact || '').toLowerCase().includes(normalizedQuery)

      return matchesStatus && matchesQuery
    })
  }, [students, searchQuery, statusFilter])

  const getStatusVariant = (studentStatus: Student['status']) => {
    if (studentStatus === 'active') return 'default'
    if (studentStatus === 'completed') return 'secondary'
    if (studentStatus === 'inactive') return 'outline'
    return 'secondary'
  }

  const handleSubmit = async () => {
    if (!name) {
      toast({ title: 'Name is required', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const result = await addStudentAction({
        name,
        email,
        parent_contact: parentContact,
        subject_exam_type: subjectExamType,
        notes,
        status,
      })
      if (result.error) throw new Error(result.error)
      toast({
        title: result.invitedExistingStudent ? 'Student invited!' : 'Student added!',
        description: result.invitedExistingStudent
          ? 'That email belongs to a student account. They need to accept the invitation before seeing this workspace.'
          : undefined,
      })
      setDialogOpen(false)
      setName('')
      setEmail('')
      setParentContact('')
      setSubjectExamType('')
      setNotes('')
      setStatus('active')
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const copyStudentSignupLink = () => {
    const url = `${window.location.origin}/login?role=student`
    navigator.clipboard.writeText(url)
    toast({ title: 'Student signup link copied!' })
  }

  const handleInviteByEmail = async () => {
    if (!studentInviteEmail.trim()) {
      toast({ title: 'Enter a student email', variant: 'destructive' })
      return
    }

    setInvitingByEmail(true)
    try {
      const result = await inviteStudentByEmailAction({ email: studentInviteEmail })
      if (result.error) throw new Error(result.error)

      if (result.alreadyExists) {
        toast({ title: 'Already connected', description: 'That student is already active in your Students Hub.' })
      } else if (result.linkedExisting) {
        toast({ title: 'Invitation sent!', description: 'Your existing student profile is now waiting for the student to accept.' })
      } else if (result.needsSignup) {
        toast({ title: 'Invitation saved', description: 'Send the signup link. The student will see this invitation after signing in with that exact email.' })
      } else {
        toast({ title: 'Invitation sent!', description: 'The student will see it when they sign in with that Google account.' })
      }

      setStudentInviteEmail('')
      router.refresh()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setInvitingByEmail(false)
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Students Hub</h1>
          <p className="text-muted-foreground">
            Manage your students, share files and assignments
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Student name"
                />
              </div>
              <div>
                <Label>Email (optional)</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@email.com"
                />
              </div>
              <div>
                <Label>Parent Contact (optional)</Label>
                <Input
                  value={parentContact}
                  onChange={(e) => setParentContact(e.target.value)}
                  placeholder="Parent/guardian email or phone"
                />
              </div>
              <div>
                <Label>Subject / Exam Type (optional)</Label>
                <Input
                  value={subjectExamType}
                  onChange={(e) => setSubjectExamType(e.target.value)}
                  placeholder="e.g. GCSE Maths, SAT, A-Level Physics"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as Student['status'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Learning goals, context, reminders..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Student
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Invite Student by Email
          </CardTitle>
          <CardDescription>
            Invite a student who already signed up with Google. If you already created a student with this email, we will link that profile after they accept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              value={studentInviteEmail}
              onChange={(e) => setStudentInviteEmail(e.target.value)}
              placeholder="student@gmail.com"
            />
            <Button onClick={handleInviteByEmail} disabled={invitingByEmail}>
              {invitingByEmail ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Invite
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-gray-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">
              Student has not signed up yet? Send them the Google student signup link first.
            </span>
            <Button variant="outline" size="sm" onClick={copyStudentSignupLink}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Signup Link
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Find students quickly by name, email, parent contact, or subject.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block">Search</Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, parent contact, subject"
              />
            </div>
            <div>
              <Label className="mb-2 block">Status</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | Student['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Showing {filteredStudents.length} of {students.length} student{students.length === 1 ? '' : 's'}.
          </p>
        </CardContent>
      </Card>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Students Yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first student to start sharing files and assignments
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </CardContent>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No matching students</h3>
            <p className="text-muted-foreground">
              Try adjusting your search text or status filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredStudents.map((student) => (
            <Card key={student.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{student.name}</h3>
                      <Badge variant={getStatusVariant(student.status)}>
                        {student.status}
                      </Badge>
                      {student.invitation_status === 'pending' && (
                        <Badge variant="warning">invite pending</Badge>
                      )}
                      {student.invitation_status === 'declined' && (
                        <Badge variant="destructive">declined</Badge>
                      )}
                    </div>
                    {student.email && (
                      <p className="text-sm text-muted-foreground">{student.email}</p>
                    )}
                    {student.parent_contact && (
                      <p className="text-xs text-muted-foreground mt-1">Parent: {student.parent_contact}</p>
                    )}
                    {student.subject_exam_type && (
                      <p className="text-xs text-muted-foreground">Subject/Exam: {student.subject_exam_type}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Added {formatDate(student.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={copyStudentSignupLink}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Signup
                    </Button>
                    <Link href={`/dashboard/students/${student.id}`}>
                      <Button size="sm">
                        Manage
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
