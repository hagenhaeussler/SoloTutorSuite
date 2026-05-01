import Image from 'next/image'
import Link from 'next/link'
import logoImage from '@/logo.png'
import { cn } from '@/lib/utils'

const logoSizes = {
  sm: {
    image: 'h-8 w-8',
    text: 'text-lg',
  },
  md: {
    image: 'h-10 w-10',
    text: 'text-2xl',
  },
} as const

interface AppLogoProps {
  href?: string
  size?: keyof typeof logoSizes
  showText?: boolean
  priority?: boolean
  className?: string
  textClassName?: string
}

export function AppLogo({
  href,
  size = 'sm',
  showText = true,
  priority = false,
  className,
  textClassName,
}: AppLogoProps) {
  const content = (
    <>
      <Image
        src={logoImage}
        alt="SoloTutorSuite logo"
        className={cn('shrink-0 rounded-lg object-contain', logoSizes[size].image)}
        priority={priority}
      />
      {showText && (
        <span className={cn('whitespace-nowrap font-bold leading-none text-foreground', logoSizes[size].text, textClassName)}>
          SoloTutorSuite
        </span>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cn('flex items-center gap-2', className)}>
        {content}
      </Link>
    )
  }

  return <div className={cn('flex items-center gap-2', className)}>{content}</div>
}
