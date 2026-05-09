import { createClient } from '@supabase/supabase-js'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'waitlist',
})

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
  const { success: allowed, limit, remaining, reset } = await ratelimit.limit(ip)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit':     String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset':     String(reset),
        },
      }
    )
  }

  try {
    const { email, name, cards_held, website } = await req.json()

    // Honeypot — bots fill hidden fields, humans don't; silently succeed so bots think it worked
    if (website) {
      return NextResponse.json({ success: true })
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    // Save to Supabase
    const { error: dbError } = await supabaseAdmin
      .from('waitlist')
      .insert({
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        cards_held: cards_held?.length ? cards_held : null,
      })

    if (dbError) {
      if (dbError.code === '23505') {
        // Duplicate — treat as success, don't expose
        return NextResponse.json({ success: true })
      }
      throw dbError
    }

    // Add contact to Loops
    if (process.env.LOOPS_API_KEY) {
      const body: Record<string, unknown> = {
        email: email.toLowerCase().trim(),
        firstName: name?.trim() || null,
        cards_held: cards_held?.join(', ') || null,
      }
      if (process.env.LOOPS_MAILING_LIST_ID) {
        body.mailingLists = { [process.env.LOOPS_MAILING_LIST_ID]: true }
      }

      const contactRes = await fetch('https://app.loops.so/api/v1/contacts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
        },
        body: JSON.stringify(body),
      })

      if (!contactRes.ok) {
        console.error('Loops create contact error:', await contactRes.text())
      }

      // Trigger confirmation email
      if (process.env.LOOPS_TRANSACTIONAL_ID) {
        const txRes = await fetch('https://app.loops.so/api/v1/transactional', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.LOOPS_API_KEY}`,
          },
          body: JSON.stringify({
            transactionalId: process.env.LOOPS_TRANSACTIONAL_ID,
            email: email.toLowerCase().trim(),
          }),
        })

        if (!txRes.ok) {
          console.error('Loops transactional error:', await txRes.text())
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Waitlist error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
