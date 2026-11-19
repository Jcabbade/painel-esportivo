import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="dsec">
      <h4>{title}</h4>
      {children}
    </section>
  )
}
