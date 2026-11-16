import type { ReactNode } from 'react'

type Props = {
  title: string
  description: string
  action?: ReactNode
}

export default function PageIntro({ title, description, action }: Props) {
  return <div className="page-intro"><div><h1>{title}</h1><p>{description}</p></div>{action && <div className="intro-action">{action}</div>}</div>
}
