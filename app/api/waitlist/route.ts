import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
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
