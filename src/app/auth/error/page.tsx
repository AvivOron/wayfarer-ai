'use client'

import { useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Suspense } from 'react'

function ErrorContent() {
  const params = useSearchParams()
  const error = params.get('error')

  const messages: Record<string, string> = {
    OAuthSignin: 'Could not start sign-in. Please try again.',
    OAuthCallback: 'Sign-in was interrupted. Please try again.',
    OAuthAccountNotLinked: 'This email is linked to another provider.',
    Default: 'An authentication error occurred.',
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-xl font-bold mb-2">Sign-in Error</h1>
        <p className="text-muted-foreground mb-6">
          {messages[error ?? 'Default'] ?? messages.Default}
        </p>
        <Button asChild className="w-full">
          <Link href="/">Try Again</Link>
        </Button>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
