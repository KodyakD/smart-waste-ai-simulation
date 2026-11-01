import type { ReactNode } from 'react'

type Props = {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}

export default function PageIntro({ eyebrow, title, description, action }: Props) {
  return <div className="page-intro"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="intro-action">{action}</div>}</div>
}
